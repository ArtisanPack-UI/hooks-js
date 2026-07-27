---
title: React
---

# React

The React adapter ships from a dedicated subpath so consumers who don't use React never pay for it:

```ts
import { useFilter, useAction, useHookedChildren, HookSlot } from '@artisanpack-ui/hooks-js/react';
```

React is declared as an optional peer dependency (`react ^18 || ^19`). If you import the `/react` entry, you must supply a compatible React version yourself.

All hooks below are backed by `useSyncExternalStore` on a per-hook version counter that bumps on every registry mutation, including changes on any reverse-alias bucket registered via [[Hook Naming and Deprecations|deprecateHook]]. They are safe under `<StrictMode>` and SSR.

## Pages

- [[React Use Filter|useFilter]] — read a filtered value; re-render on mutation.
- [[React Use Action|useAction]] — dispatch an action from an effect, deep-compare args.
- [[React Use Hooked Children|useHookedChildren]] — thread children through a filter.
- [[React Hook Slot|<HookSlot>]] — component wrapper for the filter-a-value pattern.
- [[React SSR|SSR]] — how the adapter behaves on the server.

## Common patterns

### Filtering navigation items

```tsx
import { useFilter } from '@artisanpack-ui/hooks-js/react';

type NavItem = { label: string; href: string };

export function NavBar({ items }: { items: NavItem[] }) {
  const filtered = useFilter<NavItem[]>('nav.items', items);
  return (
    <nav>
      {filtered.map((item) => (
        <a key={item.href} href={item.href}>{item.label}</a>
      ))}
    </nav>
  );
}
```

Plugins register hooks at boot:

```ts
import { addFilter } from '@artisanpack-ui/hooks-js';

addFilter('nav.items', (items) => [...items, { label: 'My plugin', href: '/plugin' }]);
```

Adding or removing a callback re-renders every mounted `NavBar` on the next microtask.

### Firing an action when data changes

```tsx
import { useAction } from '@artisanpack-ui/hooks-js/react';

export function OrderReceipt({ order }: { order: Order }) {
  useAction('order.receipt.viewed', order.id);
  return <ReceiptBody order={order} />;
}
```

`useAction` deep-compares its arguments so a freshly-allocated but semantically-equal tuple does not re-fire on re-render.

---

See also: [[Filters]], [[Actions]], [[Module Federation]] (for federated React trees).
