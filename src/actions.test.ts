import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  actionsRegistry,
  addAction,
  doAction,
  hasAction,
  removeAction,
  removeAllActions,
} from './actions';

afterEach(() => {
  actionsRegistry.reset();
});

describe('actions', () => {
  it('runs callbacks in priority order (low first) with FIFO tie-break', () => {
    const calls: string[] = [];
    addAction('boot', () => calls.push('a-default-1'));
    addAction('boot', () => calls.push('a-default-2'));
    addAction('boot', () => calls.push('a-late'), 20);
    addAction('boot', () => calls.push('a-early'), 5);
    addAction('boot', () => calls.push('a-default-3'));

    doAction('boot');

    expect(calls).toEqual(['a-early', 'a-default-1', 'a-default-2', 'a-default-3', 'a-late']);
  });

  it('forwards every argument to each callback', () => {
    const spy = vi.fn();
    addAction('greet', spy);

    doAction('greet', 'hello', 42, { flag: true });

    expect(spy).toHaveBeenCalledWith('hello', 42, { flag: true });
  });

  it('is a no-op when no callbacks are registered', () => {
    expect(() => doAction('nothing.here')).not.toThrow();
  });

  it('keeps firing already-collected callbacks even if one removes another mid-dispatch', () => {
    const calls: string[] = [];
    const second = () => calls.push('second');
    const third = () => calls.push('third');

    addAction('dispatch', () => {
      calls.push('first');
      removeAction('dispatch', third);
    });
    addAction('dispatch', second);
    addAction('dispatch', third);

    doAction('dispatch');
    expect(calls).toEqual(['first', 'second', 'third']);

    calls.length = 0;
    doAction('dispatch');
    expect(calls).toEqual(['first', 'second']);
  });

  it('defers callbacks added during dispatch to the next call', () => {
    const calls: string[] = [];
    const late = () => calls.push('late');

    addAction('reg', () => {
      calls.push('first');
      addAction('reg', late);
    });

    doAction('reg');
    expect(calls).toEqual(['first']);

    doAction('reg');
    expect(calls).toEqual(['first', 'first', 'late']);
  });

  describe('removeAction', () => {
    it('removes a specific callback at the default priority', () => {
      const cb = vi.fn();
      addAction('save', cb);

      expect(removeAction('save', cb)).toBe(true);
      doAction('save');
      expect(cb).not.toHaveBeenCalled();
    });

    it('returns false when the callback was never registered', () => {
      addAction('save', () => {});
      expect(removeAction('save', () => {})).toBe(false);
    });

    it('honors the priority argument when locating the callback', () => {
      const cb = vi.fn();
      addAction('save', cb, 5);

      expect(removeAction('save', cb)).toBe(false);
      expect(removeAction('save', cb, 5)).toBe(true);
    });

    it('only removes the first matching registration', () => {
      const cb = vi.fn();
      addAction('save', cb);
      addAction('save', cb);

      expect(removeAction('save', cb)).toBe(true);
      doAction('save');
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeAllActions', () => {
    it('clears every callback for a hook when no priority is given', () => {
      addAction('save', () => {});
      addAction('save', () => {}, 20);

      expect(removeAllActions('save')).toBe(true);
      expect(hasAction('save')).toBe(false);
    });

    it('clears only the given priority when one is provided', () => {
      const kept = vi.fn();
      const removed = vi.fn();
      addAction('save', kept);
      addAction('save', removed, 20);

      expect(removeAllActions('save', 20)).toBe(true);
      doAction('save');
      expect(kept).toHaveBeenCalledOnce();
      expect(removed).not.toHaveBeenCalled();
    });

    it('returns false when nothing was removed', () => {
      expect(removeAllActions('nope')).toBe(false);
      addAction('save', () => {});
      expect(removeAllActions('save', 20)).toBe(false);
    });
  });

  describe('hasAction', () => {
    it('reflects whether callbacks exist for the hook', () => {
      expect(hasAction('boot')).toBe(false);
      addAction('boot', () => {});
      expect(hasAction('boot')).toBe(true);
      removeAllActions('boot');
      expect(hasAction('boot')).toBe(false);
    });
  });
});
