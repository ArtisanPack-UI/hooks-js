# @artisanpack-ui/hooks-js

WordPress-style actions and filters for JavaScript, with a first-class React adapter.

Part of the [ArtisanPack UI](https://github.com/ArtisanPack-UI) ecosystem. This package is the JavaScript counterpart to [`artisanpack-ui/hooks`](https://github.com/ArtisanPack-UI/hooks) for PHP — same naming convention (`ap.<domain>.<event>`, dot-notation lowerCamelCase), same semantics for priorities, dedup, and deprecation aliases.

- **Framework-agnostic core** with zero runtime dependencies.
- **Optional React adapter** on a dedicated subpath (`/react`) so non-React consumers pay nothing.
- **Module-Federation-safe** — a shared `globalThis` singleton means duplicate copies still find each other's callbacks, and `singleton: true` in your bundler config works out of the box.
- **Deprecation aliases** (`deprecateHook`) let you rename hooks without breaking existing subscribers.
- **SSR-safe.** No `window` access on import; React hooks use `useSyncExternalStore` with a safe server snapshot.

For long-form docs — API reference, migration guide, testing recipes — see [`/docs`](./docs/home.md) or the linked pages below.

## Table of contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [API reference](#api-reference)
  - [Actions](#actions)
  - [Filters](#filters)
  - [Deprecation aliases](#deprecation-aliases)
  - [Introspection](#introspection)
- [React adapter](#react-adapter)
- [Module Federation](#module-federation)
  - [`globalThis.ApHooks` escape hatch](#globalthisaphooks-escape-hatch)
  - [Plugin `bootModule` recipe](#plugin-bootmodule-recipe)
- [DevTools debug mode](#devtools-debug-mode)
- [Hook naming convention](#hook-naming-convention)
- [Migrating from `@wordpress/hooks`](#migrating-from-wordpresshooks)
- [Cross-links](#cross-links)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install @artisanpack-ui/hooks-js
```

Requires Node.js 20+ for local development. React 18 or 19 is an optional peer dependency, needed only if you import from `@artisanpack-ui/hooks-js/react`.

## Quickstart

```ts
import { addAction, doAction, addFilter, applyFilters } from '@artisanpack-ui/hooks-js';

// Actions — fire-and-forget event triggers
addAction('order.placed', (order) => {
  // Send email, enqueue a job, log, etc.
});

doAction('order.placed', order);

// Filters — value transformations
addFilter('price.display', (price: string, currency: string) => `${currency} ${price}`);

const display = applyFilters('price.display', '49.00', 'USD'); // "USD 49.00"
```

React consumers get a set of hooks and one component:

```tsx
import { useFilter, useAction, HookSlot } from '@artisanpack-ui/hooks-js/react';

function NavBar({ items }: { items: NavItem[] }) {
  const filtered = useFilter<NavItem[]>('nav.items', items);
  return <nav>{filtered.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}</nav>;
}
```

## API reference

The core entry point exports:

```ts
import {
  // Actions
  addAction, doAction, removeAction, removeAllActions, hasAction,
  // Filters
  addFilter, applyFilters, removeFilter, removeAllFilters, hasFilter,
  // Introspection
  hasHook, VERSION,
  // Deprecations
  deprecateHook, hasAliases, aliasesFor, resetDeprecationLogState,
  // Types
  type HookCallback,
  type DeprecationLevel,
} from '@artisanpack-ui/hooks-js';
```

`HookCallback` is `(...args: unknown[]) => unknown`.

### Actions

| Function                                                         | Returns   | Notes                                                       |
| ---------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| `addAction(hook, callback, priority = 10)`                       | `void`    | Registers a callback. See [[Priorities and Execution Order|priorities]].                            |
| `doAction(hook, ...args)`                                        | `void`    | Fires every callback in priority order; return values ignored. |
| `removeAction(hook, callback, priority = 10)`                    | `boolean` | Removes one specific `(callback, priority)` match.          |
| `removeAllActions(hook, priority = false)`                       | `boolean` | Removes all callbacks; `priority` scopes to one bucket.     |
| `hasAction(hook)`                                                | `boolean` | True if any action callback is registered for the hook.     |

Callbacks registered while `doAction` is walking the list are **deferred to the next dispatch** — this matches the PHP twin and prevents surprise recursion.

Full page: [`docs/actions.md`](./docs/actions.md).

### Filters

| Function                                                         | Returns  | Notes                                                        |
| ---------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `addFilter(hook, callback, priority = 10)`                       | `void`   | Registers a callback.                                        |
| `applyFilters<T>(hook, value, ...args)`                          | `T`      | Threads `value` through every callback; returns the final result. Returns `value` unchanged when no callbacks are registered (no allocation). |
| `removeFilter(hook, callback, priority = 10)`                    | `boolean`| Removes one specific `(callback, priority)` match.           |
| `removeAllFilters(hook, priority = false)`                       | `boolean`| Removes all callbacks; `priority` scopes to one bucket.      |
| `hasFilter(hook)`                                                | `boolean`| True if any filter callback is registered for the hook.      |

Every filter callback receives the current value as its first argument and must return the (possibly modified) value.

Full page: [`docs/filters.md`](./docs/filters.md).

### Deprecation aliases

Rename a hook without breaking existing subscribers.

```ts
import { deprecateHook } from '@artisanpack-ui/hooks-js';

deprecateHook('order.placed', 'order.created');

// Both of the following now attach to (or fire) `order.created`:
addAction('order.placed', callback);
doAction('order.created', order);
```

- `addAction`/`addFilter` on the old name silently attach to the canonical name.
- `doAction`/`applyFilters` on either name fire every callback registered under either — deduped by callable identity (`===`).
- Chains collapse: `a→b` then `b→c` resolves `a→c`. Cycles throw.
- Deprecation notices log once per alias per session at the level set by `window.__AP_HOOKS_DEPRECATION_LEVEL__` (`off` / `debug` / `info` / `warn` / `error`, defaults to `info`). Call `resetDeprecationLogState()` in long-lived processes to re-arm.

Helpers: `hasAliases()`, `aliasesFor(canonical)`.

Full page: [`docs/hook-naming-and-deprecations.md`](./docs/hook-naming-and-deprecations.md).

### Introspection

- `hasAction(hook)` / `hasFilter(hook)` — bucket-specific check.
- `hasHook(hook)` — true if any action *or* filter callback exists.
- `VERSION` — the package's semver string.

## React adapter

Ships from `@artisanpack-ui/hooks-js/react`. React (18 or 19) is an optional peer dependency.

```tsx
import {
  useFilter,           // read a filtered value, re-render on mutation
  useAction,           // fire an action from an effect, deep-compare args
  useHookedChildren,   // thread ReactNode children through a filter
  HookSlot,            // component form of the filter-a-value pattern
} from '@artisanpack-ui/hooks-js/react';
```

All hooks are backed by `useSyncExternalStore` on a per-hook version counter that bumps on every registry mutation — including changes on any reverse-alias bucket. They are safe under `<StrictMode>` and SSR.

Full pages: [`docs/react.md`](./docs/react.md), [`docs/react/use-filter.md`](./docs/react/use-filter.md), [`docs/react/use-action.md`](./docs/react/use-action.md), [`docs/react/use-hooked-children.md`](./docs/react/use-hooked-children.md), [`docs/react/hook-slot.md`](./docs/react/hook-slot.md), [`docs/react/ssr.md`](./docs/react/ssr.md).

## Module Federation

Hooks are only useful when host and remote agree on a single registry. Configure your bundler to share the package as a singleton:

**`@originjs/vite-plugin-federation`**

```ts
federation({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js':       { singleton: true, strictVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, strictVersion: false },
  },
});
```

**webpack / Rspack `ModuleFederationPlugin`**

```js
new ModuleFederationPlugin({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js':       { singleton: true, requiredVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, requiredVersion: false },
  },
});
```

Even without a shared config, duplicate copies find each other via a `Symbol.for('@artisanpack-ui/hooks-js/singleton')` slot on `globalThis` — but explicit singleton config is preferred.

### `globalThis.ApHooks` escape hatch

If a remote is loaded *outside* your bundler graph (browser extension, runtime-injected `<script>`, plugin that cannot patch its federation config), it still needs a way to reach the host's registry. The package publishes its public API on `globalThis.ApHooks` on first import:

```ts
window.ApHooks.addAction('order.placed', (order) => sendReceipt(order));
window.ApHooks.doAction('order.placed', order);
```

`window.ApHooks` and `import { addAction } from '@artisanpack-ui/hooks-js'` share the same underlying registry, even across duplicate copies of the package.

### Plugin `bootModule` recipe

Runtime-loaded plugins should register their hooks **before the first page mounts**. A dedicated `bootModule` makes the ordering explicit:

```ts
// plugin/src/boot.ts
import { addAction, addFilter } from '@artisanpack-ui/hooks-js';

export function bootModule(): void {
  addAction('app.ready', () => { /* ... */ });
  addFilter('nav.items', (items) => [...items, { label: 'My plugin', href: '/plugin' }]);
}
```

```ts
// host/src/bootstrap.ts
import { bootModule } from 'plugin/boot';

async function bootstrap(): Promise<void> {
  bootModule();               // register hooks first
  await import('./app');      // then mount the app
}
bootstrap();
```

Full page: [`docs/module-federation.md`](./docs/module-federation.md).

## DevTools debug mode

Opt into a per-dispatch console log by setting `window.__AP_HOOKS_DEBUG__ = true`:

```
[ApHooks] doAction("order.placed") → 3 subscriber(s)
  { hook: 'order.placed', kind: 'doAction', args: ['[Object]'], subscribers: 3 }
```

The flag is read on every dispatch, so toggling it in DevTools takes effect immediately. `applyFilters` guards its argument-preview allocation behind the flag, so there is no cost when it's off. Leave it off in production.

Full page: [`docs/devtools-debug.md`](./docs/devtools-debug.md).

## Hook naming convention

> Hook names should be namespaced with dot notation and lower camelCase segments — for example, `order.placed`, `user.registered`, `ap.icons.registerIconSets`.
>
> The `ap.<domain>.<event>` prefix is reserved for cross-package hooks that any ArtisanPack UI package (or downstream app) may listen to.

(Verbatim from the [`artisanpack-ui/hooks` PHP README](https://github.com/ArtisanPack-UI/hooks#hook-naming-and-deprecations).)

Two of these are intentionally shared across the ecosystem today:

- `ap.google.scopes` — filter for augmenting the requested Google OAuth scopes.
- `ap.icons.registerIconSets` — filter for registering additional icon sets.

## Migrating from `@wordpress/hooks`

If you're coming from `@wordpress/hooks`, the API surface will look familiar. Key differences:

- **No namespace argument.** `addAction(hook, fn, priority)` — not `addAction(hook, ns, fn, priority)`. `removeAction` matches by `(callback, priority)`, not by string namespace.
- **Priorities** default to `10` and follow the same "lower runs first, FIFO within a priority" rules. Negative priorities are allowed here (WP silently clamps).
- **Alias handling is built in.** `deprecateHook('old', 'new')` replaces the manual "dispatch both and warn" pattern.
- **React reactivity is first-class.** `useFilter` re-renders on registry mutations without needing a wrapper.
- **SSR-safe.** No `window` access on import; server renders never subscribe.
- **Globals are separate.** WP writes to `wp.hooks`; this package writes to `globalThis.ApHooks`. The two libraries do not see each other's callbacks.

Full guide with a step-by-step migration checklist: [`docs/migration-from-wordpress-hooks.md`](./docs/migration-from-wordpress-hooks.md).

## Cross-links

- **PHP twin package**: [`artisanpack-ui/hooks`](https://github.com/ArtisanPack-UI/hooks) — the same primitives for Laravel, with Blade directives and Facades. If you're building a full-stack ArtisanPack UI app, you'll typically install both.
- **Documentation site**: [`/docs/home.md`](./docs/home.md) — the tree of Markdown docs mirrored here.
- **Issues and discussions**: <https://github.com/ArtisanPack-UI/hooks-js/issues>

## Development

```bash
npm install
npm run build           # tsup — produces dist/*.mjs, dist/*.cjs, dist/*.d.ts
npm test                # vitest run
npm run test:watch      # vitest in watch mode
npm run test:coverage   # v8 coverage report
npm run lint            # eslint
npm run type-check      # tsc --noEmit
npm run format          # prettier --write
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contribution workflow.

## License

[MIT](./LICENSE)
