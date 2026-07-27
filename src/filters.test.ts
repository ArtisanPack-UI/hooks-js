import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addFilter,
  applyFilters,
  filtersRegistry,
  hasFilter,
  removeAllFilters,
  removeFilter,
} from './filters';

afterEach(() => {
  filtersRegistry.reset();
});

describe('filters', () => {
  it('threads the value through every callback in priority + FIFO order', () => {
    addFilter('price', (v: number) => v + 1);
    addFilter('price', (v: number) => v * 2, 5);
    addFilter('price', (v: number) => v - 3);

    // Order: *2 (priority 5), +1 (10, first), -3 (10, second)
    // start=10 -> 20 -> 21 -> 18
    expect(applyFilters('price', 10)).toBe(18);
  });

  it('returns the initial value unchanged when no callbacks exist', () => {
    const initial = { foo: 'bar' };
    expect(applyFilters('unused', initial)).toBe(initial);
  });

  it('forwards remaining args unchanged to each callback', () => {
    const spy = vi.fn(
      (v: string, currency: string, locale: string) => `${locale}:${currency}:${v}`,
    );
    addFilter('price.display', spy);

    const out = applyFilters('price.display', '49.00', 'USD', 'en');

    expect(out).toBe('en:USD:49.00');
    expect(spy).toHaveBeenCalledWith('49.00', 'USD', 'en');
  });

  it('passes the updated value to subsequent callbacks but keeps other args stable', () => {
    const calls: Array<[unknown, unknown]> = [];
    addFilter('walk', (v: number, step: number) => {
      calls.push([v, step]);
      return v + step;
    });
    addFilter('walk', (v: number, step: number) => {
      calls.push([v, step]);
      return v + step;
    });

    expect(applyFilters('walk', 0, 5)).toBe(10);
    expect(calls).toEqual([
      [0, 5],
      [5, 5],
    ]);
  });

  describe('removeFilter', () => {
    it('removes a specific callback at the default priority', () => {
      const cb = (v: number) => v + 1;
      addFilter('n', cb);

      expect(removeFilter('n', cb)).toBe(true);
      expect(applyFilters('n', 1)).toBe(1);
    });

    it('honors the priority argument when locating the callback', () => {
      const cb = (v: number) => v * 2;
      addFilter('n', cb, 20);

      expect(removeFilter('n', cb)).toBe(false);
      expect(removeFilter('n', cb, 20)).toBe(true);
    });
  });

  describe('removeAllFilters', () => {
    it('clears every callback for a hook when no priority is given', () => {
      addFilter('n', (v: number) => v + 1);
      addFilter('n', (v: number) => v + 2, 20);

      expect(removeAllFilters('n')).toBe(true);
      expect(hasFilter('n')).toBe(false);
    });

    it('clears only the given priority when one is provided', () => {
      addFilter('n', (v: number) => v + 1);
      addFilter('n', (v: number) => v * 10, 20);

      expect(removeAllFilters('n', 20)).toBe(true);
      expect(applyFilters('n', 1)).toBe(2);
    });

    it('returns false when nothing was removed', () => {
      expect(removeAllFilters('nope')).toBe(false);
    });
  });

  describe('hasFilter', () => {
    it('reflects whether callbacks exist for the hook', () => {
      expect(hasFilter('boot')).toBe(false);
      addFilter('boot', (v: unknown) => v);
      expect(hasFilter('boot')).toBe(true);
      removeAllFilters('boot');
      expect(hasFilter('boot')).toBe(false);
    });
  });
});
