---
title: DevTools Debug
---

Opt into a per-dispatch console log by setting `window.__AP_HOOKS_DEBUG__ = true` before your app boots — or from DevTools at any time.

See also: [[Module Federation]] and [[Hook Naming and Deprecations]].

## Enabling

```ts
window.__AP_HOOKS_DEBUG__ = true;
```

Every `doAction` and `applyFilters` call then emits a `console.debug` line with the hook name, a compact preview of every argument, and the current subscriber count:

```
[ApHooks] doAction("order.placed") → 3 subscriber(s)
  { hook: 'order.placed', kind: 'doAction', args: ['[Object]'], subscribers: 3 }
```

The flag is read on **every dispatch**, so toggling it from DevTools takes effect immediately without a reload. `applyFilters` guards its argument-preview allocation behind the flag — reading `isDebugEnabled()` before building the preview — so there is no cost when the flag is off.

## Argument preview

Arguments are previewed with a compact repr so a large payload does not flood the console:

- Primitives: printed as-is.
- Arrays: `[<n> items]`.
- Plain objects: `[Object]`.
- React elements: `[ReactElement]`.
- Functions: `[Function: name]`.

To inspect the full argument, set a breakpoint on the callback rather than relying on the debug line.

## Turning it off in production

Leave the flag off in production builds. It is uncached and every dispatch traverses the log path. In a production bundle you probably want to strip the log setter entirely — for example, in Vite:

```ts
// vite.config.ts
define: {
  'window.__AP_HOOKS_DEBUG__': 'false',
}
```

## Related: deprecation notices

Deprecation notices are a separate log channel controlled by `window.__AP_HOOKS_DEPRECATION_LEVEL__` (`off` / `debug` / `info` / `warn` / `error`). See [[Hook Naming and Deprecations]] for the full contract.

---

Continue to [[Migration from wordpress-hooks]] →
