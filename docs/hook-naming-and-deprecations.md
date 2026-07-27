---
title: Hook Naming and Deprecations
---

`@artisanpack-ui/hooks-js` ships a `deprecateHook()` helper for renaming a hook you have already shipped, without breaking existing subscribers.

See also: [[Actions]] and [[Filters]].

## Naming convention

Hook names should use dot notation with lower camelCase segments — for example, `order.placed`, `user.registered`, `ap.icons.registerIconSets`.

The `ap.<domain>.<event>` prefix is **reserved for cross-package hooks** that any ArtisanPack UI package (or downstream app) may listen to. This convention is shared verbatim with the PHP twin so a hook name means the same thing on both sides.

Two of these are intentionally shared today:

- `ap.google.scopes` — filter for augmenting the requested Google OAuth scopes.
- `ap.icons.registerIconSets` — filter for registering additional icon sets.

## Renaming a hook

If you rename a hook, register the old name as an alias so existing subscribers keep firing:

```ts
import { deprecateHook } from '@artisanpack-ui/hooks-js';

deprecateHook('order.placed', 'order.created');
```

After that call:

- `addAction('order.placed', fn)` and `addFilter('order.placed', fn)` transparently attach to `order.created`.
- `doAction('order.placed', ...)` and `doAction('order.created', ...)` both fire every callback registered under either name.
- `removeAction`, `removeFilter`, `hasAction`, and `hasFilter` all resolve the alias silently.

## Cross-bucket dedup

If a callback is registered under both the old and new name, it fires exactly once per dispatch — the merged callback list is deduped by callable identity (`===`). This includes bound methods and arrow functions captured in the same closure.

## Chain collapse and cycles

- Chains collapse: `deprecateHook('a', 'b')` then `deprecateHook('b', 'c')` resolves `a` → `c` directly.
- Cycles throw: `deprecateHook('a', 'b')` then `deprecateHook('b', 'a')` throws a `RangeError` at registration.

## Deprecation notices

Every time an alias is resolved, the package emits a one-shot deprecation notice at the level configured by `window.__AP_HOOKS_DEPRECATION_LEVEL__`:

- `off` — silence all notices.
- `debug` — `console.debug(...)`
- `info` — `console.info(...)` (default)
- `warn` — `console.warn(...)`
- `error` — `console.error(...)`

Notices fire **once per alias per session**. Long-lived processes (workers, dev servers, service workers) can clear the "seen" set with:

```ts
import { resetDeprecationLogState } from '@artisanpack-ui/hooks-js';

resetDeprecationLogState();
```

### Trust boundary

`__AP_HOOKS_DEPRECATION_LEVEL__` is a raw global. Any script sharing the realm can set it — including to `off`, which silences the deprecation audit trail. Set it only from first-party bootstrap code and treat unexpected values as a signal, not a config source.

## Introspection helpers

- `hasAliases(): boolean` — true if any hook has been aliased. Use it to short-circuit to the non-alias fast path when false.
- `aliasesFor(canonical: string): readonly string[]` — every old-name alias that resolves to `canonical`.

---

Continue to [[React]] →
