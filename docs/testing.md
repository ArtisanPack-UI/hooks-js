---
title: Testing
---

`@artisanpack-ui/hooks-js` is tested with Vitest (jsdom environment) and ships coverage thresholds via `@vitest/coverage-v8`. This page shows how to write tests for hooks in your own code and how to run the package's suite locally.

See also: [[Actions]], [[Filters]], and [[Contributing]].

## Running the package suite

```bash
npm install
npm test                # run once
npm run test:watch      # watch mode
npm run test:coverage   # with v8 coverage report
```

Coverage thresholds enforced in CI: 95%+ on the core, 90%+ on the React adapter.

## Writing tests for actions

For actions, assert side effects — spy calls, dispatched events, updated state.

```ts
import { addAction, doAction, removeAllActions } from '@artisanpack-ui/hooks-js';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  removeAllActions('order.placed');
});

it('runs subscribers in priority order', () => {
  const calls: string[] = [];
  addAction('order.placed', () => calls.push('second'));
  addAction('order.placed', () => calls.push('first'), 5);

  doAction('order.placed', { id: 1 });

  expect(calls).toEqual(['first', 'second']);
});
```

## Writing tests for filters

For filters, assert the input → output transformation.

```ts
import { addFilter, applyFilters, removeAllFilters } from '@artisanpack-ui/hooks-js';
import { afterEach, expect, it } from 'vitest';

afterEach(() => {
  removeAllFilters('price.display');
});

it('formats currency display', () => {
  addFilter('price.display', (price: string, currency: string) => `${currency} ${price}`);

  const result = applyFilters('price.display', '49.00', 'USD');

  expect(result).toBe('USD 49.00');
});
```

## Test isolation

The registry is a module-level singleton keyed on `globalThis`. If you don't clean up between tests, callbacks bleed across them. Two options:

1. Explicitly `removeAllActions(hook)` / `removeAllFilters(hook)` in `afterEach` for every hook the test touched.
2. In a Vitest `setup.ts`, iterate the hooks your app defines and clear each one.

The package's own test suite uses the explicit-`removeAll` approach for clarity.

## Testing the React adapter

`useFilter`, `useAction`, `useHookedChildren`, and `<HookSlot>` are covered by `@testing-library/react` and `jsdom`. If you write your own tests against the adapter, remember:

- Wrap `addFilter`/`removeFilter` calls that happen outside a component render in `act(...)` so React flushes the resulting re-renders synchronously.
- `useAction` deep-compares args — pass a stable reference (or the same tuple) across renders when you're testing "should not re-fire."

## Testing deprecation aliases

Deprecation notices are one-shot per alias per session. `resetDeprecationLogState()` clears the "seen" set:

```ts
import { deprecateHook, resetDeprecationLogState } from '@artisanpack-ui/hooks-js';
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  resetDeprecationLogState();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
```

---

Continue to [[FAQ]] →
