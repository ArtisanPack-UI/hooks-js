import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Importing the entry module for its side effect: it installs the public API
// on `globalThis.ApHooks` at load. Tests below assert on that surface, and
// this top-level import guarantees the install happened before any test runs
// (no matter which test file vitest loads first).
import './index';

import { actionsRegistry, addAction, doAction, hasAction, removeAllActions } from './actions';
import { addFilter, applyFilters, filtersRegistry, removeAllFilters } from './filters';
import { debugLog, isDebugEnabled } from './singleton';

interface DebugGlobals {
  __AP_HOOKS_DEBUG__?: unknown;
}

afterEach(() => {
  actionsRegistry.reset();
  filtersRegistry.reset();
  delete (globalThis as DebugGlobals).__AP_HOOKS_DEBUG__;
  vi.restoreAllMocks();
});

describe('cross-module singleton', () => {
  it('shares state between actions and filters modules', () => {
    // Both `actionsRegistry` and `filtersRegistry` are sourced from
    // `./singleton`. Callbacks added through the actions API must be
    // visible via the registry re-exported from actions.ts.
    const spy = vi.fn();
    addAction('shared', spy);

    expect(actionsRegistry.has('shared')).toBe(true);
    doAction('shared', 42);
    expect(spy).toHaveBeenCalledWith(42);

    removeAllActions('shared');
    expect(hasAction('shared')).toBe(false);
  });

  it('persists on globalThis under a well-known symbol', () => {
    const key = Symbol.for('@artisanpack-ui/hooks-js/singleton');
    const shape = (globalThis as unknown as Record<symbol, unknown>)[key] as {
      actionsRegistry: unknown;
      filtersRegistry: unknown;
      deprecations: unknown;
    };
    expect(shape).toBeDefined();
    expect(shape.actionsRegistry).toBe(actionsRegistry);
    expect(shape.filtersRegistry).toBe(filtersRegistry);
  });

  it('exposes the public API on globalThis.ApHooks', () => {
    const g = globalThis as { ApHooks?: Record<string, unknown> };
    expect(g.ApHooks).toBeDefined();
    expect(typeof g.ApHooks!.addAction).toBe('function');
    expect(typeof g.ApHooks!.applyFilters).toBe('function');
    expect(typeof g.ApHooks!.deprecateHook).toBe('function');
  });

  it('routes ApHooks.addAction into the same bucket as the imported addAction', () => {
    const g = globalThis as {
      ApHooks?: {
        addAction: typeof addAction;
        doAction: typeof doAction;
      };
    };
    const spy = vi.fn();
    g.ApHooks!.addAction('global.ping', spy);
    doAction('global.ping', 'hi');
    expect(spy).toHaveBeenCalledWith('hi');

    const spy2 = vi.fn();
    addAction('global.ping.2', spy2);
    g.ApHooks!.doAction('global.ping.2', 'yo');
    expect(spy2).toHaveBeenCalledWith('yo');
  });
});

describe('DevTools debug logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('is disabled by default', () => {
    expect(isDebugEnabled()).toBe(false);
    addAction('quiet', () => {});
    doAction('quiet', 'x');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('logs doAction dispatches when __AP_HOOKS_DEBUG__ is true', () => {
    (globalThis as DebugGlobals).__AP_HOOKS_DEBUG__ = true;
    addAction('loud', () => {});
    addAction('loud', () => {});
    doAction('loud', 'hi', 42);

    expect(console.debug).toHaveBeenCalledOnce();
    const call = (console.debug as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toContain('doAction("loud")');
    expect(call[0]).toContain('2 subscriber(s)');
    const details = call[1] as { hook: string; args: unknown[]; subscribers: number };
    expect(details.hook).toBe('loud');
    expect(details.args).toEqual(['hi', 42]);
    expect(details.subscribers).toBe(2);
  });

  it('logs applyFilters dispatches with the seed value in the arg preview', () => {
    (globalThis as DebugGlobals).__AP_HOOKS_DEBUG__ = true;
    addFilter('shape', (v: string) => v);
    applyFilters<string>('shape', 'seed', 'ctx');

    expect(console.debug).toHaveBeenCalledOnce();
    const details = (console.debug as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![1] as { args: unknown[]; subscribers: number };
    expect(details.args).toEqual(['seed', 'ctx']);
    expect(details.subscribers).toBe(1);
  });

  it('previews objects, arrays, and long strings without deep-cloning', () => {
    debugLog(
      'doAction',
      'preview',
      [{ big: 'obj' }, [1, 2, 3], 'x'.repeat(200), () => {}, null, undefined],
      0,
    );
    // Not enabled: no log.
    expect(console.debug).not.toHaveBeenCalled();

    (globalThis as DebugGlobals).__AP_HOOKS_DEBUG__ = true;
    debugLog(
      'doAction',
      'preview',
      [{ big: 'obj' }, [1, 2, 3], 'x'.repeat(200), function named() {}, null, undefined],
      0,
    );
    const details = (console.debug as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![1] as { args: unknown[] };
    expect(details.args[0]).toBe('[Object]');
    expect(details.args[1]).toBe('[Array(3)]');
    expect((details.args[2] as string).endsWith('…')).toBe(true);
    expect(details.args[3]).toBe('[Function named]');
    expect(details.args[4]).toBeNull();
    expect(details.args[5]).toBeUndefined();
  });

  it('treats non-true values as "off"', () => {
    (globalThis as DebugGlobals).__AP_HOOKS_DEBUG__ = 'yes';
    expect(isDebugEnabled()).toBe(false);
    (globalThis as DebugGlobals).__AP_HOOKS_DEBUG__ = 1;
    expect(isDebugEnabled()).toBe(false);
  });
});

describe('parity edge cases (issue #6)', () => {
  afterEach(() => {
    filtersRegistry.reset();
    actionsRegistry.reset();
  });

  it('applyFilters returns the seed value unchanged when nothing is subscribed', () => {
    const seed = { id: 1 };
    const out = applyFilters('empty.filter', seed);
    expect(out).toBe(seed);
  });

  it('removeAllActions with a specific priority leaves other priorities intact', () => {
    const p5 = vi.fn();
    const p10a = vi.fn();
    const p10b = vi.fn();
    const p20 = vi.fn();
    addAction('multi', p5, 5);
    addAction('multi', p10a);
    addAction('multi', p10b);
    addAction('multi', p20, 20);

    expect(removeAllActions('multi', 10)).toBe(true);
    doAction('multi');
    expect(p5).toHaveBeenCalledOnce();
    expect(p10a).not.toHaveBeenCalled();
    expect(p10b).not.toHaveBeenCalled();
    expect(p20).toHaveBeenCalledOnce();
  });

  it('removeAllFilters with a specific priority leaves other priorities intact', () => {
    addFilter('n', (v: number) => v + 1, 5);
    addFilter('n', (v: number) => v * 10);
    addFilter('n', (v: number) => v - 100, 20);

    expect(removeAllFilters('n', 10)).toBe(true);
    // (1 + 1) then -100 = -98
    expect(applyFilters('n', 1)).toBe(-98);
  });

  it('cross-alias dedup fires bound methods with matching identity exactly once', async () => {
    const { deprecateHook, deprecations } = await import('./deprecations');
    class Handler {
      calls = 0;
      handle = (): void => {
        this.calls++;
      };
    }
    const h = new Handler();

    // Same arrow-property reference registered under both names — must dedup.
    addAction('old.tick', h.handle);
    addAction('tick', h.handle);
    deprecateHook('old.tick', 'tick');

    doAction('tick');
    expect(h.calls).toBe(1);

    deprecations.reset();
    actionsRegistry.reset();
  });

  it('documents add-during-dispatch semantics: added callback is deferred to the next call', () => {
    const calls: string[] = [];
    const late = (): void => {
      calls.push('late');
    };
    addAction('boot', () => {
      calls.push('early');
      addAction('boot', late);
    });

    // First dispatch: the newly-added `late` is snapshotted out of the
    // priority bucket before `early` runs, so `late` is deferred.
    doAction('boot');
    expect(calls).toEqual(['early']);

    // Second dispatch: `late` is now visible.
    doAction('boot');
    expect(calls).toEqual(['early', 'early', 'late']);
  });
});
