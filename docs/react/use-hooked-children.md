---
title: useHookedChildren
---

# useHookedChildren

```ts
function useHookedChildren(hook: string, children: ReactNode, ctx?: unknown): ReactNode
```

Threads a `ReactNode` through a filter, letting plugins inject, replace, or wrap children without the parent component knowing about them.

See also: [[React|React overview]] and [[React Hook Slot|<HookSlot>]].

## Usage

```tsx
import { useHookedChildren } from '@artisanpack-ui/hooks-js/react';

function CardHeader({ children, card }: { children: ReactNode; card: Card }) {
  const content = useHookedChildren('card.header.children', children, card);
  return <header>{content}</header>;
}
```

Plugins can wrap or extend the header:

```ts
import { addFilter } from '@artisanpack-ui/hooks-js';

addFilter('card.header.children', (children, card) => (
  <>
    <Badge cardId={card.id} />
    {children}
  </>
));
```

Adding or removing the filter re-renders every `CardHeader` on the next microtask.

## When to reach for `<HookSlot>` instead

`<HookSlot>` (see [[React Hook Slot|<HookSlot>]]) is a component wrapper around the same primitive. Prefer it when you want the JSX site to read as a slot rather than a hook call — e.g. inside another component's render tree where a hook call would obscure the structure.
