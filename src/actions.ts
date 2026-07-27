/**
 * Action hooks — fire-and-forget callbacks keyed by hook name.
 */

import { deprecations } from './deprecations';
import { createRegistry, type HookCallback } from './registry';

export const actionsRegistry = createRegistry();

export function addAction(hook: string, callback: HookCallback, priority = 10): void {
  actionsRegistry.add(deprecations.resolveSilent(hook), callback, priority);
}

export function doAction(hook: string, ...args: unknown[]): void {
  const canonical = deprecations.resolve(hook);
  const callbacks = deprecations.hasAliases()
    ? actionsRegistry.collectMany([canonical, ...deprecations.aliasesFor(canonical)])
    : actionsRegistry.collect(canonical);
  for (const callback of callbacks) {
    callback(...args);
  }
}

export function removeAction(hook: string, callback: HookCallback, priority = 10): boolean {
  return actionsRegistry.remove(deprecations.resolveSilent(hook), callback, priority);
}

export function removeAllActions(hook: string, priority: number | false = false): boolean {
  return actionsRegistry.removeAll(deprecations.resolveSilent(hook), priority);
}

export function hasAction(hook: string): boolean {
  return actionsRegistry.has(deprecations.resolveSilent(hook));
}
