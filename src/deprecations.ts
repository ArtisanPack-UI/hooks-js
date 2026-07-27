/**
 * Hook Deprecations Manager
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
 */

export type DeprecationLevel = 'off' | 'debug' | 'info' | 'warn' | 'error';

const KNOWN_LEVELS: readonly DeprecationLevel[] = ['off', 'debug', 'info', 'warn', 'error'];

// Named globals go through a typed accessor so we do not sprinkle
// `as unknown as { ... }` casts across the module.
interface DeprecationGlobals {
  __AP_HOOKS_DEPRECATION_LEVEL__?: DeprecationLevel | string;
}

function readGlobalLevel(): DeprecationLevel {
  const g = typeof globalThis === 'undefined' ? undefined : (globalThis as DeprecationGlobals);
  const raw = g?.__AP_HOOKS_DEPRECATION_LEVEL__;
  if (typeof raw !== 'string' || raw === '') return 'info';
  const normalized = raw.toLowerCase() as DeprecationLevel;
  return KNOWN_LEVELS.includes(normalized) ? normalized : 'info';
}

interface DeprecationManager {
  alias(old: string, canonical: string): void;
  /** Resolve `hook` to its canonical name and log once per alias per session. */
  resolve(hook: string): string;
  /** Resolve without logging — used by add/remove bookkeeping. */
  resolveSilent(hook: string): string;
  /** Reverse index: every old-name alias that resolves to `canonical`. */
  aliasesFor(canonical: string): readonly string[];
  hasAliases(): boolean;
  resetLogState(): void;
  reset(): void;
}

function pushUnique(index: Map<string, string[]>, key: string, value: string): void {
  let bucket = index.get(key);
  if (!bucket) {
    bucket = [];
    index.set(key, bucket);
  }
  if (!bucket.includes(value)) bucket.push(value);
}

function createDeprecationManager(): DeprecationManager {
  const aliases = new Map<string, string>();
  const reverseIndex = new Map<string, string[]>();
  const logged = new Set<string>();

  function log(old: string, canonical: string): void {
    const level = readGlobalLevel();
    if (level === 'off') return;
    const message = `Hook "${old}" is deprecated; use "${canonical}" instead.`;
    const target = (console as unknown as Record<string, (...a: unknown[]) => void>)[level];
    if (typeof target === 'function') {
      target(message, { old, canonical });
    }
  }

  return {
    alias(old, canonical) {
      if (old === canonical) return;

      // Walk the alias chain from `canonical` to its terminal target. The
      // usual chain-collapse invariant (every alias hops directly to the
      // ultimate canonical) is not enough on its own — a previously-canonical
      // name can become an alias target of a later rename, breaking one-hop
      // resolution. Walking the full chain also lets us catch multi-hop
      // cycles (e.g. c→a already exists, then a→b; adding b→c would form
      // c→a→b→c and a one-hop check would miss it).
      let resolvedCanonical = canonical;
      const visited = new Set<string>([old]);
      while (aliases.has(resolvedCanonical)) {
        if (visited.has(resolvedCanonical)) break;
        visited.add(resolvedCanonical);
        resolvedCanonical = aliases.get(resolvedCanonical)!;
      }

      if (resolvedCanonical === old) {
        throw new Error(
          `Refusing to alias hook "${old}" to "${canonical}": would create a cycle ` +
            `("${canonical}" already resolves to "${old}").`,
        );
      }

      // Idempotent alias(a,b) calls are a no-op past this point — the
      // existing edge is already correct, and re-appending would grow
      // reverseIndex without bound.
      if (aliases.get(old) === resolvedCanonical) return;

      // If old was itself the target of prior aliases, walk them forward so
      // every historical name now points at the new canonical in one hop.
      const priorOlds = reverseIndex.get(old);
      if (priorOlds) {
        for (const priorOld of priorOlds) {
          aliases.set(priorOld, resolvedCanonical);
          pushUnique(reverseIndex, resolvedCanonical, priorOld);
        }
        reverseIndex.delete(old);
      }

      aliases.set(old, resolvedCanonical);
      pushUnique(reverseIndex, resolvedCanonical, old);
    },

    resolve(hook) {
      const canonical = aliases.get(hook);
      if (canonical === undefined) return hook;
      if (!logged.has(hook)) {
        logged.add(hook);
        log(hook, canonical);
      }
      return canonical;
    },

    resolveSilent(hook) {
      return aliases.get(hook) ?? hook;
    },

    aliasesFor(canonical) {
      return reverseIndex.get(canonical) ?? [];
    },

    hasAliases() {
      return aliases.size > 0;
    },

    resetLogState() {
      logged.clear();
    },

    reset() {
      aliases.clear();
      reverseIndex.clear();
      logged.clear();
    },
  };
}

export const deprecations = createDeprecationManager();

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
