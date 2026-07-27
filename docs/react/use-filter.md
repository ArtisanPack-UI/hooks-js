---
title: useFilter
---

# useFilter

```ts
function useFilter<T>(hook: string, value: T, ...args: unknown[]): T
```

Reads a filter's current output. The component re-renders whenever any callback is added or removed under `hook` — or under any of its deprecation aliases.

See also: [[React|React overview]] and [[Filters]].

## Usage

```tsx
import { useFilter } from '@artisanpack-ui/hooks-js/react';

function PriceTag({ price, currency }: { price: string; currency: string }) {
  const display = useFilter<string>('price.display', `${currency} ${price}`, currency);
  return <span>{display}</span>;
}
```

Every call to `applyFilters('price.display', ...)` — from React or non-React code — reads the same registry. When a filter callback is registered, every mounted `PriceTag` re-renders on the next microtask and picks up the new pipeline.

## Extra args

Extra positional arguments after `value` are forwarded to every filter callback exactly as they are for `applyFilters`. They participate in the re-render decision the same way — a new callback triggers a re-render, but changing `args` alone does not (React re-renders when its own inputs change; the hook subscription only cares about registry version).

## SSR

On the server, `useFilter` runs `applyFilters` once with the current registry and never subscribes. On hydrate, the subscription attaches and the component picks up any post-mount registrations on the next render. See [[React SSR|SSR]].

## Reactivity across aliases

If `deprecateHook('a', 'b')` is in effect, subscribing to `useFilter('a', ...)` re-renders on mutations to **either** bucket. This ensures old-name subscribers see new callbacks registered under the canonical name and vice-versa. See [[Hook Naming and Deprecations]].
