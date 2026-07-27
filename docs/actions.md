---
title: Actions
---

Actions let you register callbacks on named hooks and execute them later. Use them for decoupled event-style triggers.

See also: [[Filters]] and [[Priorities and Execution Order]].

## API

- `addAction(hook: string, callback: HookCallback, priority?: number): void` — default priority `10`.
- `doAction(hook: string, ...args: unknown[]): void`
- `removeAction(hook: string, callback: HookCallback, priority?: number): boolean`
- `removeAllActions(hook: string, priority?: number | false): boolean` — `false` (default) removes every priority.
- `hasAction(hook: string): boolean`
- `deprecateHook(oldName: string, newName: string): void` — see [[Hook Naming and Deprecations]].

`HookCallback` is `(...args: unknown[]) => unknown` — the return value from an action callback is ignored.

## Usage

```ts
import { addAction, doAction } from '@artisanpack-ui/hooks-js';

addAction('order.placed', (order) => {
  // Handle the order placed event
});

// Later, when the event occurs
doAction('order.placed', order);
```

## Priorities

Control execution order with the optional `priority` parameter. Lower numbers run first.

```ts
addAction('order.placed', () => console.log('first'), 5);
addAction('order.placed', () => console.log('second'));       // default 10
addAction('order.placed', () => console.log('third'), 20);
```

Read more in [[Priorities and Execution Order]].

## Removing callbacks

Remove a specific callback, or remove all callbacks for an action (optionally scoped to a priority).

```ts
import { addAction, removeAction, removeAllActions } from '@artisanpack-ui/hooks-js';

const callback = () => console.log('will be removed');

addAction('user.registered', callback);
addAction('user.registered', () => console.log('still here'), 20);

// Remove a specific callback (returns true when removed)
const removed = removeAction('user.registered', callback); // true

// Remove all callbacks at a given priority
removeAllActions('user.registered', 20);

// Remove every callback for the hook
removeAllActions('user.registered');
```

- `removeAction(...)` returns `true` when a matching `(callback, priority)` pair was found and removed.
- `removeAllActions(...)` returns `true` if callbacks existed and were removed.

## Add-during-dispatch semantics

Callbacks registered while `doAction` is walking the callback list are **not** invoked during the current dispatch — they attach to the registry and fire on the next `doAction` call. This matches the PHP twin's behavior and prevents surprise infinite recursion when a handler adds another handler for the same hook.

## Best practices

- Keep callbacks small and focused.
- Prefer enqueuing background work for anything expensive.
- Namespace hook names (`order.placed`, `user.registered`, `ap.icons.registerIconSets`) to avoid collisions. See [[Hook Naming and Deprecations]].

---

Continue to [[Filters]] →
