# @artisanpack-ui/hooks-js

WordPress-style actions and filters for JavaScript, with a React adapter.

Part of the [ArtisanPack UI](https://github.com/ArtisanPack-UI) ecosystem. This package is the JavaScript counterpart to [`artisanpack-ui/hooks`](https://github.com/ArtisanPack-UI/hooks) for PHP.

## Status

Early scaffold. The public API is not yet stable.

## Installation

```bash
npm install @artisanpack-ui/hooks-js
```

## Usage

The core entry point exposes framework-agnostic hook primitives:

```ts
import { /* actions & filters */ } from '@artisanpack-ui/hooks-js';
```

React bindings are shipped from a dedicated subpath so consumers who don't use React pay nothing for it:

```ts
import { /* React hooks */ } from '@artisanpack-ui/hooks-js/react';
```

## Module Federation

Hooks are only useful when host and remote agree on a single registry. Two bundled copies of this package cannot see each other's callbacks, and a bug that hides subscribers silently is far worse than a load error.

**Always share the package as a singleton.** Configure your bundler with `singleton: true` so the host and every remote resolve to the same module instance:

**`@originjs/vite-plugin-federation`**

```ts
federation({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js': { singleton: true, strictVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, strictVersion: false },
  },
});
```

**webpack `ModuleFederationPlugin`**

```js
new ModuleFederationPlugin({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js': { singleton: true, requiredVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, requiredVersion: false },
  },
});
```

**Rspack `ModuleFederationPlugin`**

```js
new rspack.container.ModuleFederationPlugin({
  name: 'host',
  shared: {
    '@artisanpack-ui/hooks-js': { singleton: true, requiredVersion: false },
    '@artisanpack-ui/hooks-js/react': { singleton: true, requiredVersion: false },
  },
});
```

### `globalThis.ApHooks` escape hatch

If a remote is loaded *outside* your bundler graph (a browser extension, a runtime-injected `<script>`, or a plugin whose author cannot patch their federation config), it still needs a way to reach the host's registry. The package publishes its public API on `globalThis.ApHooks` on first import:

```ts
// Anywhere on the page, no import required:
window.ApHooks.addAction('order.placed', (order) => sendReceipt(order));
window.ApHooks.doAction('order.placed', order);
```

`window.ApHooks` and `import { addAction } from '@artisanpack-ui/hooks-js'` share the same underlying registry — via a `Symbol.for('@artisanpack-ui/hooks-js/singleton')` slot on `globalThis` — so a callback added through one route fires when dispatched through the other, even across duplicate copies of the package.

Prefer the `shared: singleton` config; `ApHooks` is the fallback.

### Plugin `bootModule` recipe

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

async function bootstrap() {
  bootModule(); // register hooks first
  await import('./app'); // now mount the app — its actions/filters see the plugin
}

bootstrap();
```

Plugins that cannot ship a bundler-integrated `bootModule` can achieve the same ordering by reading `window.ApHooks` and registering as soon as their `<script>` loads, provided that script is included ahead of the app bundle.

### DevTools debug mode

Opt into a per-dispatch console log by setting `window.__AP_HOOKS_DEBUG__ = true` before your app boots (or from DevTools at any time):

```ts
window.__AP_HOOKS_DEBUG__ = true;
```

Each `doAction` and `applyFilters` call then emits a `console.debug` line with the hook name, a compact preview of every argument, and the current subscriber count:

```
[ApHooks] doAction("order.placed") → 3 subscriber(s)
  { hook: 'order.placed', kind: 'doAction', args: ['[Object]'], subscribers: 3 }
```

The flag is read on every dispatch, so toggling it in DevTools takes effect immediately without a reload. Leave it off in production — it is uncached and every call goes through the log path.

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run type-check
```

## License

[MIT](./LICENSE)
