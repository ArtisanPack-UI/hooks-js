import { addAction, doAction, hasAction, removeAction, removeAllActions } from './actions';
import { aliasesFor, deprecateHook, hasAliases, resetDeprecationLogState } from './deprecations';
import { addFilter, applyFilters, hasFilter, removeAllFilters, removeFilter } from './filters';

export const VERSION = '0.0.0';

export type { HookCallback } from './registry';

export { addAction, doAction, removeAction, removeAllActions, hasAction };

export { addFilter, applyFilters, removeFilter, removeAllFilters, hasFilter };

export {
  deprecateHook,
  hasAliases,
  aliasesFor,
  resetDeprecationLogState,
  type DeprecationLevel,
} from './deprecations';

/**
 * True if any action OR filter callback is registered under this hook name.
 */
export function hasHook(hook: string): boolean {
  return hasAction(hook) || hasFilter(hook);
}

/**
 * Public API surface exposed on `globalThis.ApHooks` as an escape hatch for
 * plugins that cannot import the package directly (Module Federation remotes
 * loaded at runtime, browser extensions, `<script>`-injected snippets).
 *
 * The registries backing these functions live in `./singleton`, so calls
 * through `window.ApHooks.addAction(...)` and `import { addAction }` end up
 * in the same buckets — even across duplicate package copies.
 */
export interface ApHooksGlobal {
  version: string;
  addAction: typeof addAction;
  doAction: typeof doAction;
  removeAction: typeof removeAction;
  removeAllActions: typeof removeAllActions;
  hasAction: typeof hasAction;
  addFilter: typeof addFilter;
  applyFilters: typeof applyFilters;
  removeFilter: typeof removeFilter;
  removeAllFilters: typeof removeAllFilters;
  hasFilter: typeof hasFilter;
  hasHook: typeof hasHook;
  deprecateHook: typeof deprecateHook;
  hasAliases: typeof hasAliases;
  aliasesFor: typeof aliasesFor;
  resetDeprecationLogState: typeof resetDeprecationLogState;
}

declare global {
  var ApHooks: ApHooksGlobal | undefined;
}

function installGlobal(): void {
  const g = globalThis as { ApHooks?: Partial<ApHooksGlobal> };
  const desired: ApHooksGlobal = {
    version: VERSION,
    addAction,
    doAction,
    removeAction,
    removeAllActions,
    hasAction,
    addFilter,
    applyFilters,
    removeFilter,
    removeAllFilters,
    hasFilter,
    hasHook,
    deprecateHook,
    hasAliases,
    aliasesFor,
    resetDeprecationLogState,
  };

  if (!g.ApHooks) {
    g.ApHooks = desired;
    return;
  }

  // A copy already installed the surface. Fill in any keys it is missing —
  // when host and remote ship different package versions and the OLDER copy
  // loads first, the newer copy still needs to backfill methods added later.
  // Existing keys are left alone: both copies share state via the underlying
  // singleton, so whichever function reference wins is functionally
  // equivalent.
  const existing = g.ApHooks as Record<string, unknown>;
  for (const [key, value] of Object.entries(desired)) {
    if (!(key in existing)) {
      existing[key] = value;
    }
  }
}

installGlobal();
