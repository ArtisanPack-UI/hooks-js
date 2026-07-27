---
title: Priorities and Execution Order
---

Hooks (both actions and filters) run callbacks in ascending priority order. Lower numbers execute first. Callbacks registered with the same priority run in the order they were added (FIFO).

See also: [[Actions]] and [[Filters]].

## How priorities work

- Default priority is `10`.
- Smaller numbers run earlier; larger numbers run later.
- When priorities are equal, callbacks execute in registration order.
- Priorities are plain JavaScript `number`s — any finite integer is valid. Unlike `@wordpress/hooks`, negative priorities are supported, and there is no `Number.MAX_SAFE_INTEGER` upper bound to reserve.

### Example (Actions)

```ts
addAction('order.placed', () => console.log('A: priority 5'), 5);
addAction('order.placed', () => console.log('B: priority 10'));
addAction('order.placed', () => console.log('C: priority 20'), 20);
```

Execution order: A, B, C.

### Example (Filters)

```ts
addFilter('title.display', (title: string) => title.toUpperCase(), 5);
addFilter('title.display', (title: string) => `${title}!`);

const result = applyFilters('title.display', 'Hello');
// 'HELLO!'
```

## Add-during-dispatch

If a callback registers another callback during dispatch, the newly-registered callback is deferred to the next dispatch. This applies to both actions and filters and matches the PHP twin.

## Deprecation aliases

When two names are aliased via `deprecateHook`, callbacks under the old name and the canonical name are merged into a single ordered list at dispatch time. Callables that are `===`-equal are deduped — a callback registered under both names fires exactly once. See [[Hook Naming and Deprecations]].

---

Continue to [[Hook Naming and Deprecations]] →
