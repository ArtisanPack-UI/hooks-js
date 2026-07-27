---
title: SSR
---

# SSR

The React adapter is safe under server-side rendering. This page explains what happens on the server, what happens on hydrate, and what to do when a filter must produce the same output on both sides.

See also: [[React|React overview]] and [[React Use Filter|useFilter]].

## What happens on the server

On the server, React calls each component's render function synchronously and then throws away every subscription — there is no commit phase and no `useEffect`. To stay compatible, the adapter's hooks:

- `useFilter` runs `applyFilters` once against the current server-side registry and returns the value. No subscription is attached, and `getServerSnapshot` returns the current union-version integer so React can hydrate without a mismatch.
- `useAction` never dispatches on the server — the underlying effect only runs on the client.
- `useHookedChildren` and `<HookSlot>` behave like `useFilter`.

## What happens on hydrate

On the client, after the first render, `useSyncExternalStore` attaches its subscription. If any callbacks were registered between server render and hydrate (for example, plugin code that ran only in the client bundle), the version counter's changed value triggers one immediate re-render that picks up the new pipeline.

## Registering filters on both sides

If a filter must run on both server and client, register it in code that both bundles execute. A typical pattern is a shared "boot" module imported at the top of both entry points:

```ts
// shared/hooks-boot.ts
import { addFilter } from '@artisanpack-ui/hooks-js';

addFilter('nav.items', (items) => [...items, { label: 'Docs', href: '/docs' }]);
```

```ts
// server entry
import './shared/hooks-boot';
import { renderToString } from 'react-dom/server';
// ...
```

```ts
// client entry
import './shared/hooks-boot';
import { hydrateRoot } from 'react-dom/client';
// ...
```

If registration is skipped on one side, the initial HTML and the hydrated tree will differ and React will log a hydration mismatch.

## Client-only filters

Filters that only make sense in the browser (e.g. reading `localStorage`) should be registered from a `useEffect` or a client-only module. `useFilter` will return the server-rendered value on the first render, then re-render on the client with the freshly-registered filter's output.
