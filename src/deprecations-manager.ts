/**
 * Deprecation manager factory.
 *
 * Kept separate from `./deprecations` so `./singleton` can construct the
 * shared instance without a circular import (deprecations.ts imports the
 * singleton to re-export the shared manager).
 *
 * See `./deprecations` for the public API and behavior contract.
 */

export type DeprecationLevel = 'off' | 'debug' | 'info' | 'warn' | 'error';

const KNOWN_LEVELS: readonly DeprecationLevel[] = ['off', 'debug', 'info', 'warn', 'error'];

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

export interface DeprecationManager {
  alias(old: string, canonical: string): void;
  resolve(hook: string): string;
  resolveSilent(hook: string): string;
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

export function createDeprecationManager(): DeprecationManager {
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

      if (aliases.get(old) === resolvedCanonical) return;

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
