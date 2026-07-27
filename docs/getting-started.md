---
title: Getting Started
---

Welcome to `@artisanpack-ui/hooks-js`. This guide will get you up and running quickly.

See also: [[Actions]], [[Filters]], and [[React]].

## Requirements

- Node.js 20+ (for local development and tooling)
- Any modern browser or server-side JS runtime that supports ES2020
- React 18 or 19 (optional — only if you use `@artisanpack-ui/hooks-js/react`)

## Installation

```bash
npm install @artisanpack-ui/hooks-js
```

There is nothing to register — the package installs a shared registry on `globalThis` on first import, so any module that imports it can register or dispatch hooks immediately.

## Entry points

The package ships two entry points so React is never pulled into non-React bundles:

```ts
// Framework-agnostic core
import { addAction, doAction, addFilter, applyFilters } from '@artisanpack-ui/hooks-js';

// React adapter (only if you use React)
import { useFilter, useAction } from '@artisanpack-ui/hooks-js/react';
```

The `react` subpath is marked as an optional peer dependency; consumers that only use the core entry never resolve React.

## Quick Start

### Actions

Register a callback on a named action and dispatch it later.

```ts
import { addAction, doAction } from '@artisanpack-ui/hooks-js';

addAction('order.placed', (order) => {
  // Send email, enqueue a job, log, etc.
});

// Somewhere else in your code when the order is placed:
doAction('order.placed', order);
```

Read more in [[Actions]].

### Filters

Filters pass a value through one or more callbacks. Each callback receives the current value as the first argument and must return the (possibly modified) value.

```ts
import { addFilter, applyFilters } from '@artisanpack-ui/hooks-js';

addFilter('price.display', (price: string, currency: string) => {
  return `${currency} ${price}`; // e.g., "USD 49.00"
});

const display = applyFilters('price.display', '49.00', 'USD');
```

Read more in [[Filters]].

### Priorities

Callbacks run in ascending priority order (lower numbers first). See [[Priorities and Execution Order]].

### React

Prefer React hooks? `useFilter` re-renders on registry mutations, `useAction` dispatches from effects, and `<HookSlot>` transforms children through a filter. See [[React]].

---

Continue to [[Actions]] →
