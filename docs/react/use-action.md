---
title: useAction
---

# useAction

```ts
function useAction(hook: string, ...args: unknown[]): void
```

Dispatches an action from a React effect. The action fires once on mount and again whenever `args` change — using a deep comparison so freshly-allocated but semantically-equal tuples do not re-fire.

See also: [[React|React overview]] and [[Actions]].

## Usage

```tsx
import { useAction } from '@artisanpack-ui/hooks-js/react';

function OrderReceipt({ order }: { order: Order }) {
  useAction('order.receipt.viewed', order.id);
  return <ReceiptBody order={order} />;
}
```

`doAction('order.receipt.viewed', order.id)` runs on mount. If `order.id` never changes, no further dispatches happen — even across dozens of re-renders.

## Deep-compare vs. React's referential equality

React's built-in `useEffect` dependency array uses `Object.is`. That means a new array or object passed by parent re-renders would re-run the effect, even if the contents are equivalent. `useAction` deep-compares the `args` tuple so:

```tsx
useAction('user.search', { q: query, page: 1 }); // does not re-fire when parent re-renders with an equivalent object
```

The deep comparison walks arrays, plain objects, `Map`, `Set`, and primitives. Class instances are compared by reference — pass a stable reference or extract the fields you care about.

## StrictMode

Under `<StrictMode>` in development, React mounts every effect twice. `useAction` guards against the double-mount so `doAction` fires exactly once — the deep-compare cache is keyed on the args tuple, and the second mount sees an equivalent tuple.

## Not for render-time side effects

Use `useAction` for genuinely one-shot dispatches tied to a component's lifecycle. If you want to react to prop changes with a filtered value in render, use [[React Use Filter|useFilter]] instead.
