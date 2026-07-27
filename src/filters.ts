/**
 * Filter hooks — threaded transformations of a value through every callback.
 */

import { deprecations } from './deprecations';
import { createRegistry, type HookCallback } from './registry';

export const filtersRegistry = createRegistry();

export function addFilter(hook: string, callback: HookCallback, priority = 10): void {
  filtersRegistry.add(deprecations.resolveSilent(hook), callback, priority);
}

export function applyFilters<T>(hook: string, value: T, ...args: unknown[]): T {
  const canonical = deprecations.resolve(hook);
  const callbacks = deprecations.hasAliases()
    ? filtersRegistry.collectMany([canonical, ...deprecations.aliasesFor(canonical)])
    : filtersRegistry.collect(canonical);
  if (callbacks.length === 0) return value;

  let current: unknown = value;
  for (const callback of callbacks) {
    current = callback(current, ...args);
  }
  return current as T;
}

export function removeFilter(hook: string, callback: HookCallback, priority = 10): boolean {
  return filtersRegistry.remove(deprecations.resolveSilent(hook), callback, priority);
}

export function removeAllFilters(hook: string, priority: number | false = false): boolean {
  return filtersRegistry.removeAll(deprecations.resolveSilent(hook), priority);
}

export function hasFilter(hook: string): boolean {
  return filtersRegistry.has(deprecations.resolveSilent(hook));
}
