/**
 * Action hooks — fire-and-forget callbacks keyed by hook name.
 */

import { createRegistry, type HookCallback } from './registry';

export const actionsRegistry = createRegistry();

export function addAction(hook: string, callback: HookCallback, priority = 10): void {
  actionsRegistry.add(hook, callback, priority);
}

export function doAction(hook: string, ...args: unknown[]): void {
  for (const callback of actionsRegistry.collect(hook)) {
    callback(...args);
  }
}

export function removeAction(hook: string, callback: HookCallback, priority = 10): boolean {
  return actionsRegistry.remove(hook, callback, priority);
}

export function removeAllActions(hook: string, priority: number | false = false): boolean {
  return actionsRegistry.removeAll(hook, priority);
}

export function hasAction(hook: string): boolean {
  return actionsRegistry.has(hook);
}
