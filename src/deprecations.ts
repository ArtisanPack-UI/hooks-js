/**
 * Hook Deprecations public API.
 *
 * Tracks aliases between old and canonical hook names so that renames can
 * ship without silently breaking existing subscribers.
 *
 * Ports `ArtisanPackUI\Hooks\HookDeprecations` from the PHP package. Instead
 * of Laravel's Log facade, the JS version routes deprecation notices through
 * `console` at the level configured via `window.__AP_HOOKS_DEPRECATION_LEVEL__`
 * (`off` / `debug` / `info` / `warn` / `error`). Defaults to `info`.
 *
 * Trust boundary: `__AP_HOOKS_DEPRECATION_LEVEL__` is a raw global and any
 * script sharing the realm can set it — including to `off`, which silences
 * the deprecation audit trail. Set it only from first-party bootstrap code
 * and treat unexpected values as a signal, not a config source.
 *
 * The underlying manager lives in `./singleton` so parallel copies of the
 * package (Module Federation without `shared: singleton`) share aliases.
 */

import { deprecations } from './singleton';

export type { DeprecationLevel } from './deprecations-manager';
export { deprecations };

/**
 * Register a rename from `oldName` to `newName`. Subsequent
 * `addAction`/`addFilter` on `oldName` silently attach to `newName`, and
 * `doAction`/`applyFilters` on either name fire callbacks registered under
 * either — deduplicated by callable identity.
 *
 * @throws If the rename would form a cycle (`a→b` then `b→a`).
 */
export function deprecateHook(oldName: string, newName: string): void {
  deprecations.alias(oldName, newName);
}

/**
 * True if any hook has been aliased. Consumers can short-circuit to the
 * non-alias fast path when this is false.
 */
export function hasAliases(): boolean {
  return deprecations.hasAliases();
}

/**
 * Every old-name alias that resolves to `canonical`. Empty array when none.
 */
export function aliasesFor(canonical: string): readonly string[] {
  return deprecations.aliasesFor(canonical);
}

/**
 * Clear the "seen this alias" set so each deprecation notice can fire again
 * on the next resolution. Intended for long-lived processes (workers,
 * hot-reload dev servers) that want the notice per request/job rather than
 * once at process boot.
 */
export function resetDeprecationLogState(): void {
  deprecations.resetLogState();
}
