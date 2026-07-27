---
title: Migration from wordpress-hooks
---

If you are coming from `@wordpress/hooks`, the API surface will look familiar — same function names, same "actions and filters" mental model. This page catalogs the behavioral differences you need to know before switching.

See also: [[Actions]], [[Filters]], [[Priorities and Execution Order]], and [[React]].

## API shape at a glance

| Concept                   | `@wordpress/hooks`                                | `@artisanpack-ui/hooks-js`                            |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Register action           | `addAction(hook, ns, fn, priority)`               | `addAction(hook, fn, priority)`                       |
| Fire action               | `doAction(hook, ...args)`                         | `doAction(hook, ...args)`                             |
| Remove specific callback  | `removeAction(hook, ns)` (removes ALL for `ns`)   | `removeAction(hook, fn, priority)` (specific match)   |
| Remove all callbacks      | `removeAllActions(hook)`                          | `removeAllActions(hook, priority?)`                   |
| Register filter           | `addFilter(hook, ns, fn, priority)`               | `addFilter(hook, fn, priority)`                       |
| Apply filter              | `applyFilters(hook, value, ...args)`              | `applyFilters(hook, value, ...args)`                  |
| Check registered          | `hasAction(hook, ns?)`                            | `hasAction(hook)`                                     |
| Alias / rename            | not built in                                      | `deprecateHook(oldName, newName)`                     |
| React adapter             | `@wordpress/data`, custom `useSelect` wrappers    | `useFilter`, `useAction`, `useHookedChildren`, `HookSlot` |

## Namespaces are gone

`@wordpress/hooks` requires a `namespace` string on every `addAction`/`addFilter` call, primarily so `removeAction(hook, ns)` can remove a plugin's callbacks in bulk. `@artisanpack-ui/hooks-js` drops the namespace argument entirely — callback identity is enough because `removeAction` matches by `(callback, priority)` reference, not by string namespace.

**Migration:** delete the second argument.

```ts
// Before
wpHooks.addAction('my.hook', 'my-plugin', callback);

// After
addAction('my.hook', callback);
```

If you relied on `removeAction(hook, 'my-plugin')` to wipe every callback a plugin registered, you have two options:

1. Keep references to each callback in your plugin and call `removeAction(hook, callback)` per handler.
2. Use `removeAllActions(hook)` if all callbacks on the hook belong to you (rare in a plugin system).

## Priority semantics

- Default priority is `10` (same as WP).
- Lower runs first (same as WP).
- Equal priorities: FIFO (same as WP).
- **`@artisanpack-ui/hooks-js` allows negative priorities.** WP treats non-numeric priorities as `10`; this package requires a valid `number`.

## Alias handling

`@wordpress/hooks` has no built-in rename story — deprecating a hook typically means firing both `doAction('old', ...)` and `doAction('new', ...)` in your dispatch code, with a `console.warn` for the old callers.

`@artisanpack-ui/hooks-js` ships `deprecateHook(oldName, newName)`. See [[Hook Naming and Deprecations]]. After one call, both old and new subscribers fire on either dispatch, deduped by callable identity, with one-shot deprecation notices at a configurable level.

## React reactivity

`@wordpress/hooks` is not React-aware. Components that read a filter and want to re-render on registration must either subscribe manually or wrap the read in a `useSelect` from `@wordpress/data`.

`@artisanpack-ui/hooks-js/react` ships `useFilter` (and friends) on top of `useSyncExternalStore`. Components re-render on every registry mutation for the hook name and its aliases. See [[React]].

## Filter return value

Both libraries require filter callbacks to return the value. `@artisanpack-ui/hooks-js` returns the seed value unchanged (no allocation) when zero callbacks are registered — WP does the same, but the JS implementation guards more aggressively on the hot path.

## Add-during-dispatch

Both libraries defer callbacks registered while dispatching to the next dispatch — this is intentional and matches the PHP twin.

## SSR

`@wordpress/hooks` is browser-only in practice (WP admin runs in a browser). `@artisanpack-ui/hooks-js` runs unchanged on the server: no `window` access on import, no `document` reads, and the React adapter is SSR-safe (see [[React SSR|SSR]]).

## Globals

`@wordpress/hooks` writes to `wp.hooks` on the browser global (via `wp-hooks` handle). `@artisanpack-ui/hooks-js` writes to `globalThis.ApHooks` as its escape hatch (see [[Module Federation]]) and stores its registry on a `Symbol.for('@artisanpack-ui/hooks-js/singleton')` slot so duplicate copies share state. The two globals are independent — one library does not see the other's callbacks.

## Step-by-step migration checklist

1. Replace every `import { addAction, addFilter, ... } from '@wordpress/hooks'` with `import { addAction, addFilter, ... } from '@artisanpack-ui/hooks-js'`.
2. Remove the `namespace` argument from every `addAction` / `addFilter` / `removeAction` / `removeFilter` call.
3. If you used `removeAction(hook, namespace)` to bulk-remove a plugin's callbacks, refactor to keep callback references and remove them individually — or use `removeAllActions(hook, priority?)` if appropriate.
4. If you have code that manually double-dispatches for a rename (`doAction('old', ...); doAction('new', ...)`), replace it with a single `deprecateHook('old', 'new')` at boot and delete the duplicated dispatch sites.
5. In React components that read filter values, swap manual subscription code for `useFilter(hook, seed, ...args)`.
6. If you run under Module Federation, configure `shared: { singleton: true }` for `@artisanpack-ui/hooks-js` and `@artisanpack-ui/hooks-js/react` (see [[Module Federation]]).

---

Continue to [[Testing]] →
