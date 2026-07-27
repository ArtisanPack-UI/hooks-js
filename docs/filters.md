---
title: Filters
---

Filters transform values by threading them through one or more callbacks. Each callback receives the current value as the first argument and must return the (possibly modified) value.

See also: [[Actions]] and [[Priorities and Execution Order]].

## API

- `addFilter(hook: string, callback: HookCallback, priority?: number): void` — default priority `10`.
- `applyFilters<T>(hook: string, value: T, ...args: unknown[]): T`
- `removeFilter(hook: string, callback: HookCallback, priority?: number): boolean`
- `removeAllFilters(hook: string, priority?: number | false): boolean` — `false` (default) removes every priority.
- `hasFilter(hook: string): boolean`
- `deprecateHook(oldName: string, newName: string): void` — see [[Hook Naming and Deprecations]].

`applyFilters` is generic in the seed value's type. When no callbacks are registered, the seed value is returned as-is (no allocation, no dispatch).

## Usage

```ts
import { addFilter, applyFilters } from '@artisanpack-ui/hooks-js';

addFilter('price.display', (price: string, currency: string) => {
  return `${currency} ${price}`; // "USD 49.00"
});

const display = applyFilters('price.display', '49.00', 'USD');
```

## Chaining and priorities

Multiple callbacks can modify the value; they run in ascending priority order. The output of one filter becomes the input to the next.

```ts
addFilter('content.summary', (text: string) => text.slice(0, 200), 5);
addFilter('content.summary', (text: string) => text.trim());

const summary = applyFilters('content.summary', post.body);
```

## Removing callbacks

```ts
import { addFilter, removeFilter, removeAllFilters } from '@artisanpack-ui/hooks-js';

const callback = (value: string) => `${value}_removed`;

addFilter('text.process', callback);                                  // priority 10
addFilter('text.process', (v: string) => v.toUpperCase(), 20);

// Remove a specific callback
const removed = removeFilter('text.process', callback); // true

// Remove all callbacks at a given priority
removeAllFilters('text.process', 20);

// Remove every callback for the hook
removeAllFilters('text.process');
```

## Best practices

- **Always return the value.** A filter callback that returns `undefined` will propagate `undefined` to the next callback.
- Keep filters deterministic; avoid side effects when possible.
- Prefer narrow, well-typed callback signatures over `unknown` — cast at the boundary where you register the filter.

---

Continue to [[Priorities and Execution Order]] →
