import { hasAction } from './actions';
import { hasFilter } from './filters';

export const VERSION = '0.0.0';

export type { HookCallback } from './registry';

export { addAction, doAction, removeAction, removeAllActions, hasAction } from './actions';

export { addFilter, applyFilters, removeFilter, removeAllFilters, hasFilter } from './filters';

/**
 * True if any action OR filter callback is registered under this hook name.
 */
export function hasHook(hook: string): boolean {
  return hasAction(hook) || hasFilter(hook);
}
