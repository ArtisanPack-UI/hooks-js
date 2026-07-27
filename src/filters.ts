/**
 * Filter hooks — threaded transformations of a value through every callback.
 */

import { createRegistry, type HookCallback } from './registry';

export const filtersRegistry = createRegistry();

export function addFilter(hook: string, callback: HookCallback, priority = 10): void {
  filtersRegistry.add(hook, callback, priority);
}

export function applyFilters<T>(hook: string, value: T, ...args: unknown[]): T {
  const callbacks = filtersRegistry.collect(hook);
  if (callbacks.length === 0) return value;

  let current: unknown = value;
  for (const callback of callbacks) {
    current = callback(current, ...args);
  }
  return current as T;
}

export function removeFilter(hook: string, callback: HookCallback, priority = 10): boolean {
  return filtersRegistry.remove(hook, callback, priority);
}

export function removeAllFilters(hook: string, priority: number | false = false): boolean {
  return filtersRegistry.removeAll(hook, priority);
}

export function hasFilter(hook: string): boolean {
  return filtersRegistry.has(hook);
}
