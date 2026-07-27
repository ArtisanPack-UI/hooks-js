/**
 * Cross-realm hook state singleton.
 *
 * When two copies of `@artisanpack-ui/hooks-js` end up in the same runtime —
 * typically because a Module Federation host and a remote both bundle the
 * package without `shared: { singleton: true }` — each copy would otherwise
 * get its own private registries and callbacks registered against one copy
 * would be invisible to dispatches on the other.
 *
 * We defuse that by stashing the registries and deprecation manager on
 * `globalThis` under a well-known symbol on first load. Every subsequent
 * module init observes the existing state and re-uses it, so `addAction`
 * from copy A and `doAction` from copy B hit the same bucket.
 *
 * Consumers should still prefer Module Federation's `shared` config — this
 * global is the escape hatch, not the primary contract.
 */

import { createDeprecationManager, type DeprecationManager } from './deprecations-manager';
import { createRegistry, type HookRegistry } from './registry';

interface SingletonShape {
  actionsRegistry: HookRegistry;
  filtersRegistry: HookRegistry;
  deprecations: DeprecationManager;
}

const KEY = Symbol.for('@artisanpack-ui/hooks-js/singleton');

interface SingletonGlobals {
  [KEY]?: SingletonShape;
}

function readOrCreate(): SingletonShape {
  const g = globalThis as SingletonGlobals;
  const existing = g[KEY];
  if (existing) return existing;

  const state: SingletonShape = {
    actionsRegistry: createRegistry(),
    filtersRegistry: createRegistry(),
    deprecations: createDeprecationManager(),
  };

  // Non-enumerable to avoid surprising `Object.keys(globalThis)` consumers.
  // `writable: false` blocks straight reassignment; `configurable: true`
  // still lets tests `delete globalThis[KEY]` and reinitialize when they
  // need a hard reset.
  Object.defineProperty(g, KEY, {
    value: state,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return state;
}

const state = readOrCreate();

export const actionsRegistry = state.actionsRegistry;
export const filtersRegistry = state.filtersRegistry;
export const deprecations = state.deprecations;

/**
 * True if the DevTools debug flag is set. Read at each dispatch so consumers
 * can flip it at runtime without a page reload.
 */
export function isDebugEnabled(): boolean {
  const g = globalThis as { __AP_HOOKS_DEBUG__?: unknown };
  return g.__AP_HOOKS_DEBUG__ === true;
}

/**
 * Compact preview of a dispatch argument for the DevTools log. Objects and
 * arrays are summarized rather than deep-cloned to keep the log cheap.
 */
function previewArg(value: unknown): unknown {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string') {
    const s = value as string;
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  }
  if (t === 'number' || t === 'boolean' || t === 'undefined' || t === 'bigint') return value;
  if (t === 'function') {
    const fn = value as { name?: string };
    return `[Function ${fn.name || 'anonymous'}]`;
  }
  if (t === 'symbol') return (value as symbol).toString();
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name ?? 'Object';
  return `[${ctor}]`;
}

/**
 * Emit a DevTools log entry for a dispatch. No-op unless
 * `globalThis.__AP_HOOKS_DEBUG__ === true`.
 */
export function debugLog(
  kind: 'doAction' | 'applyFilters',
  hook: string,
  argsPreview: readonly unknown[],
  subscriberCount: number,
): void {
  if (!isDebugEnabled()) return;
  const target = console.debug ?? console.log;
  target.call(console, `[ApHooks] ${kind}("${hook}") → ${subscriberCount} subscriber(s)`, {
    hook,
    kind,
    args: argsPreview.map(previewArg),
    subscribers: subscriberCount,
  });
}
