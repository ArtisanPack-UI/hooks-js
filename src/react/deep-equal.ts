/**
 * Small structural equality check used by useAction to avoid re-firing when
 * the caller passes freshly-allocated arg tuples whose contents are equal.
 *
 * Not intended as a general-purpose deep-equal — handles plain objects,
 * arrays, and primitives (via Object.is). Depth is capped so cyclic or
 * pathologically deep args return `false` (safe fallback: useAction just
 * re-fires) rather than blowing the stack.
 */
const MAX_DEPTH = 64;

export function deepEqual(a: unknown, b: unknown): boolean {
  return deepEqualAt(a, b, 0);
}

function deepEqualAt(a: unknown, b: unknown, depth: number): boolean {
  if (Object.is(a, b)) return true;
  if (depth >= MAX_DEPTH) return false;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqualAt(arrA[i], arrB[i], depth + 1)) return false;
    }
    return true;
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!deepEqualAt(objA[key], objB[key], depth + 1)) return false;
  }
  return true;
}
