---
title: Module Federation
---

Hooks are only useful when host and remote agree on a single registry. Two bundled copies of this package can share a registry via `globalThis` — but the safest and most explicit path is to declare the package as a singleton in your bundler.

See also: [[Getting Started]] and [[React]].

## The problem

Every runtime-loaded remote in a Module-Federation-style setup normally ships its own copy of every dependency. If both the host and a remote bundle `@artisanpack-ui/hooks-js`, and their bundlers do nothing special, each copy would ordinarily have its own module-scope map and see none of the other copy's callbacks.

`@artisanpack-ui/hooks-js` sidesteps this by installing its registry on a `Symbol.for('@artisanpack-ui/hooks-js/singleton')` slot on `globalThis`, so duplicate copies **do** share state. But it is still strongly preferred to configure your bundler to load a single copy — you get proper tree-shaking, one set of types, and one canonical function reference for `removeAction`/`removeFilter`.

## Bundler configuration

### `@originjs/vite-plugin-federation`

```ts
federation({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js':       { singleton: true, strictVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, strictVersion: false },
  },
});
```

### webpack `ModuleFederationPlugin`

```js
new ModuleFederationPlugin({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js':       { singleton: true, requiredVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, requiredVersion: false },
  },
});
```

### Rspack `ModuleFederationPlugin`

```js
new rspack.container.ModuleFederationPlugin({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js':       { singleton: true, requiredVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, requiredVersion: false },
  },
});
```

`strictVersion: false` / `requiredVersion: false` avoids a load error when host and remote ship different minor or patch versions. The registries are compatible across minor versions by design; only the public function signatures matter, and those are stable within a major.

## `globalThis.ApHooks` escape hatch

If a remote is loaded *outside* your bundler graph (a browser extension, a runtime-injected `<script>`, a plugin whose author cannot patch their federation config), it still needs a way to reach the host's registry. The package publishes its public API on `globalThis.ApHooks` on first import:

```ts
// Anywhere on the page, no import required:
window.ApHooks.addAction('order.placed', (order) => sendReceipt(order));
window.ApHooks.doAction('order.placed', order);
```

`window.ApHooks` and `import { addAction }` share the same underlying registry — via the `Symbol.for('@artisanpack-ui/hooks-js/singleton')` slot on `globalThis` — so a callback added through one route fires when dispatched through the other, even across duplicate copies of the package.

The full API surface is available on `window.ApHooks`: `addAction`, `doAction`, `removeAction`, `removeAllActions`, `hasAction`, `addFilter`, `applyFilters`, `removeFilter`, `removeAllFilters`, `hasFilter`, `hasHook`, `deprecateHook`, `hasAliases`, `aliasesFor`, `resetDeprecationLogState`, and `version`.

Prefer the `shared: singleton` config; `ApHooks` is the fallback.

## Plugin `bootModule` recipe

Runtime-loaded plugins should register their hooks **before the first page mounts**, so callbacks are in place the moment the host emits its first action or applies its first filter. A `bootModule` — a dedicated entry that only wires up hooks — makes that ordering explicit:

```ts
// plugin/src/boot.ts
import { addAction, addFilter } from '@artisanpack-ui/hooks-js';

export function bootModule(): void {
  addAction('app.ready', () => {
    // side effects that need to run once the host is up
  });

  addFilter('nav.items', (items) => [...items, { label: 'My plugin', href: '/plugin' }]);
}
```

```ts
// host/src/bootstrap.ts
import { bootModule } from 'plugin/boot';

async function bootstrap(): Promise<void> {
  bootModule();               // register hooks first
  await import('./app');      // now mount the app — its actions/filters see the plugin
}

bootstrap();
```

Plugins that cannot ship a bundler-integrated `bootModule` can achieve the same ordering by reading `window.ApHooks` and registering as soon as their `<script>` loads, provided that script is included ahead of the app bundle.

## Version introspection

Every copy of the package exports a `VERSION` string and exposes the same value at `window.ApHooks.version`. When the escape hatch is installed by an older copy first, a newer copy's `installGlobal` backfills any missing methods without overwriting existing keys — this preserves whichever function reference won the race while ensuring every documented method is callable.

---

Continue to [[DevTools Debug]] →
