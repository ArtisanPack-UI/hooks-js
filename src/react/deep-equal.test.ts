import { describe, expect, it } from 'vitest';

import { deepEqual } from './deep-equal';

describe('deepEqual', () => {
  it('matches equal primitives via Object.is', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('x', 'x')).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
  });

  it('walks arrays and plain objects', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('array vs object of same shape is not equal', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2, length: 2 })).toBe(false);
  });

  it('returns false for cyclic input rather than blowing the stack', () => {
    type Node = { self?: Node };
    const a: Node = {};
    a.self = a;
    const b: Node = {};
    b.self = b;
    expect(() => deepEqual(a, b)).not.toThrow();
    expect(deepEqual(a, b)).toBe(false);
  });
});
