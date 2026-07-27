import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { actionsRegistry, addAction, doAction, hasAction, removeAction } from './actions';
import {
  aliasesFor,
  deprecateHook,
  deprecations,
  hasAliases,
  resetDeprecationLogState,
} from './deprecations';
import { addFilter, applyFilters, filtersRegistry, removeFilter } from './filters';

interface DepGlobals {
  __AP_HOOKS_DEPRECATION_LEVEL__?: string;
}

afterEach(() => {
  actionsRegistry.reset();
  filtersRegistry.reset();
  deprecations.reset();
  const g = globalThis as DepGlobals;
  delete g.__AP_HOOKS_DEPRECATION_LEVEL__;
  vi.restoreAllMocks();
});

describe('deprecateHook', () => {
  it('routes addAction on an alias to the canonical bucket', () => {
    deprecateHook('old.boot', 'boot');
    const spy = vi.fn();
    addAction('old.boot', spy);

    doAction('boot');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('fires callbacks registered on either alias or canonical when dispatched under either name', () => {
    const calls: string[] = [];
    // Pre-alias registration under the old name stays in the old-name
    // bucket; the reverse-index dispatch path must still find it.
    addAction('old.boot', () => calls.push('pre-alias-old'));
    addAction('boot', () => calls.push('canonical'));

    deprecateHook('old.boot', 'boot');

    addAction('old.boot', () => calls.push('post-alias-old'));

    doAction('boot');
    expect(calls).toEqual(['pre-alias-old', 'canonical', 'post-alias-old']);

    calls.length = 0;
    doAction('old.boot');
    expect(calls).toEqual(['pre-alias-old', 'canonical', 'post-alias-old']);
  });

  it('deduplicates by callable identity across old and canonical buckets', () => {
    const spy = vi.fn();
    addAction('old.boot', spy);
    addAction('boot', spy);
    deprecateHook('old.boot', 'boot');

    doAction('boot');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('preserves global priority order across merged buckets', () => {
    const calls: string[] = [];
    addAction('old.boot', () => calls.push('old@20'), 20);
    addAction('boot', () => calls.push('canon@5'), 5);
    addAction('boot', () => calls.push('canon@10'));
    deprecateHook('old.boot', 'boot');

    doAction('boot');
    expect(calls).toEqual(['canon@5', 'canon@10', 'old@20']);
  });

  it('collapses alias chains so a→b, b→c yields a→c', () => {
    deprecateHook('a', 'b');
    deprecateHook('b', 'c');

    const spy = vi.fn();
    addAction('a', spy);
    doAction('c');

    expect(spy).toHaveBeenCalledOnce();
    expect(aliasesFor('c')).toEqual(expect.arrayContaining(['a', 'b']));
    expect(aliasesFor('b')).toEqual([]);
  });

  it('rejects cycles', () => {
    deprecateHook('a', 'b');
    expect(() => deprecateHook('b', 'a')).toThrow(/cycle/i);
  });

  it('rejects multi-hop cycles across chain-collapse edges', () => {
    // c→a, then a→b (which walks c forward to c→b). Adding b→c would form
    // c→b→c — a cycle a one-hop check would miss.
    deprecateHook('c', 'a');
    deprecateHook('a', 'b');
    expect(() => deprecateHook('b', 'c')).toThrow(/cycle/i);
  });

  it('is idempotent — repeated deprecateHook(a,b) does not grow the reverse index', () => {
    deprecateHook('a', 'b');
    deprecateHook('a', 'b');
    deprecateHook('a', 'b');
    expect(aliasesFor('b')).toEqual(['a']);
  });

  it('is a no-op when old === new', () => {
    expect(() => deprecateHook('same', 'same')).not.toThrow();
    expect(hasAliases()).toBe(false);
  });

  it('applies to filters too, deduping across buckets', () => {
    const upper = (v: string): string => v.toUpperCase();
    addFilter('old.title', upper);
    addFilter('title', upper);
    deprecateHook('old.title', 'title');

    expect(applyFilters<string>('title', 'hello')).toBe('HELLO');
  });

  it('lets removeAction target either name', () => {
    deprecateHook('old.boot', 'boot');
    const cb = vi.fn();
    addAction('old.boot', cb);

    expect(removeAction('old.boot', cb)).toBe(true);
    doAction('boot');
    expect(cb).not.toHaveBeenCalled();
  });

  it('lets removeFilter target either name', () => {
    deprecateHook('old.title', 'title');
    const cb = vi.fn((v: string) => v);
    addFilter('title', cb);

    expect(removeFilter('old.title', cb)).toBe(true);
    applyFilters<string>('title', 'x');
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('deprecation logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('logs at info level by default, once per alias per session', () => {
    deprecateHook('old.boot', 'boot');
    addAction('boot', () => {});

    doAction('old.boot');
    doAction('old.boot');
    doAction('old.boot');

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(
      'Hook "old.boot" is deprecated; use "boot" instead.',
      { old: 'old.boot', canonical: 'boot' },
    );
  });

  it('does not log during add/remove/hasAction bookkeeping', () => {
    deprecateHook('old.boot', 'boot');
    addAction('old.boot', () => {});
    removeAction('old.boot', () => {});
    hasAction('old.boot');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('respects the "off" level', () => {
    (globalThis as DepGlobals).__AP_HOOKS_DEPRECATION_LEVEL__ = 'off';
    deprecateHook('old.boot', 'boot');
    doAction('old.boot');
    expect(console.info).not.toHaveBeenCalled();
  });

  it('routes to console.warn when level = "warn"', () => {
    (globalThis as DepGlobals).__AP_HOOKS_DEPRECATION_LEVEL__ = 'warn';
    deprecateHook('old.boot', 'boot');
    doAction('old.boot');
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('falls back to info for unknown levels', () => {
    (globalThis as DepGlobals).__AP_HOOKS_DEPRECATION_LEVEL__ = 'shout';
    deprecateHook('old.boot', 'boot');
    doAction('old.boot');
    expect(console.info).toHaveBeenCalledOnce();
  });

  it('re-logs after resetDeprecationLogState()', () => {
    deprecateHook('old.boot', 'boot');
    doAction('old.boot');
    resetDeprecationLogState();
    doAction('old.boot');
    expect(console.info).toHaveBeenCalledTimes(2);
  });
});

describe('hasAliases / aliasesFor', () => {
  it('is false with no aliases registered', () => {
    expect(hasAliases()).toBe(false);
    expect(aliasesFor('anything')).toEqual([]);
  });

  it('reflects registered aliases', () => {
    deprecateHook('a', 'canonical');
    deprecateHook('b', 'canonical');
    expect(hasAliases()).toBe(true);
    expect(aliasesFor('canonical')).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
