---
title: HookSlot
---

# `<HookSlot>`

```tsx
<HookSlot<T> hook={string} value={T} args={unknown[]}>
  {(filtered: T) => ReactNode}
</HookSlot>
```

Component wrapper for the filter-a-value pattern. Renders its render-prop child with the filtered value; re-renders when the underlying filter's callbacks change.

See also: [[React|React overview]] and [[React Use Filter|useFilter]].

## Usage

```tsx
import { HookSlot } from '@artisanpack-ui/hooks-js/react';

function OrderSummary({ order }: { order: Order }) {
  return (
    <HookSlot<string>
      hook="order.summary.text"
      value={`Order #${order.id}`}
      args={[order]}
    >
      {(text) => <h2>{text}</h2>}
    </HookSlot>
  );
}
```

Under the hood `<HookSlot>` is a thin wrapper around [[React Use Filter|useFilter]]. Prefer it when you want the JSX to read as a slot — the `value`/`args` props make the "seed and extras" split more visible than positional arguments to a hook.

## Typing

The generic parameter `T` is inferred from `value`. It flows through to the render-prop child's argument. Prefer explicit type parameters (`<HookSlot<Foo>>`) when the seed value is an empty array or `null` and inference would otherwise widen to `never[]` or `null`.
