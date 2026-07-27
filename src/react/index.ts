import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

import { actionsRegistry, doAction } from '../actions';
import { deprecations } from '../deprecations';
import { applyFilters, filtersRegistry } from '../filters';

import { deepEqual } from './deep-equal';

export { VERSION } from '../index';

/**
 * Every hook name that dispatches under `hook` — canonical plus any
 * reverse-index aliases when deprecations are in play. Callers use it to
 * subscribe to every bucket a mutation could land in.
 */
function unionNames(hook: string): readonly string[] {
  const canonical = deprecations.resolveSilent(hook);
  if (!deprecations.hasAliases()) return [canonical];
  const aliases = deprecations.aliasesFor(canonical);
  if (aliases.length === 0) return [canonical];
  return [canonical, ...aliases];
}

function sumVersions(
  registry: { version(hook: string): number },
  names: readonly string[],
): number {
  let sum = 0;
  for (const name of names) sum += registry.version(name);
  return sum;
}

function subscribeAll(
  registry: { subscribe(hook: string, listener: () => void): () => void },
  names: readonly string[],
  listener: () => void,
): () => void {
  const unsubs = names.map((name) => registry.subscribe(name, listener));
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

/**
 * Read a filter's current output. Re-renders when any callback is
 * added/removed under `hook` (or any of its aliases).
 *
 * SSR: `getServerSnapshot` returns the current union version so React can
 * render on the server without subscribing. On hydrate the subscription is
 * attached and the component picks up any post-mount registrations on the
 * next render.
 */
export function useFilter<T>(hook: string, value: T, ...args: unknown[]): T {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeAll(filtersRegistry, unionNames(hook), onChange),
    [hook],
  );
  const getSnapshot = useCallback(() => sumVersions(filtersRegistry, unionNames(hook)), [hook]);
  // Reading `version` binds this component to the store: React will re-run
  // useFilter whenever any callback under `hook` (or its aliases) is added
  // or removed. `applyFilters` is cheap enough to run on every render — a
  // wrapping React.memo on the parent is the right tool for skipping
  // re-renders when value/args are unchanged.
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return applyFilters<T>(hook, value, ...args);
}

/**
 * Fire `doAction(hook, ...args)` on mount and every time `args` deep-changes.
 * Deep-equality avoids re-firing on freshly-allocated but semantically-equal
 * arg tuples — the common React case where the parent re-renders and passes
 * a new array/object literal. Depth is capped (see `deepEqual`); cyclic or
 * very deep args are treated as changed and cause the action to re-fire.
 */
export function useAction(hook: string, ...args: unknown[]): void {
  const lastRef = useRef<{ hook: string; args: unknown[] } | null>(null);
  useEffect(() => {
    const last = lastRef.current;
    if (last !== null && last.hook === hook && deepEqual(last.args, args)) return;
    lastRef.current = { hook, args };
    doAction(hook, ...args);
  });
}

/**
 * Filter a React children tree through `hook`. Thin wrapper over
 * `useFilter` typed for the wrap-children pattern.
 */
export function useHookedChildren(hook: string, children: ReactNode, ctx?: unknown): ReactNode {
  return useFilter<ReactNode>(hook, children, ctx);
}

export interface HookSlotProps<T> {
  hook: string;
  value: T;
  args?: readonly unknown[];
  /** Rendered when no filter or action is registered under `hook`. */
  children?: ReactNode;
}

/**
 * Declarative slot: renders the filtered `value` when any callback is
 * registered under `hook`, otherwise falls back to `children`.
 *
 * "Registered" means action OR filter — a component can supply a placeholder
 * that plugins can either replace outright (filter) or leave visible while
 * still observing (action).
 */
export function HookSlot<T>({ hook, value, args, children }: HookSlotProps<T>): ReactNode {
  const argsArray = args ?? [];
  const filtered = useFilter<T>(hook, value, ...argsArray);
  const names = unionNames(hook);
  let hasAny = false;
  for (const name of names) {
    if (filtersRegistry.has(name) || actionsRegistry.has(name)) {
      hasAny = true;
      break;
    }
  }
  return hasAny ? (filtered as ReactNode) : (children ?? null);
}
