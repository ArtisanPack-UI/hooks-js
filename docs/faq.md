---
title: FAQ
---

Frequently asked questions about `@artisanpack-ui/hooks-js`.

## Do I need React to use this package?

No. The core entry (`@artisanpack-ui/hooks-js`) has no React dependency. React is only pulled in when you import the `/react` subpath, and even then it is an optional peer dependency you supply yourself.

## How is this different from `@wordpress/hooks`?

Similar API, different semantics in several places — no namespace argument, built-in deprecation aliases, first-class React hooks, SSR-safe. See [[Migration from wordpress-hooks]] for a full diff.

## How do I control execution order?

Use priorities. Lower numbers run first. See [[Priorities and Execution Order]].

## Should I use actions/filters or an event bus?

Event buses excel at broadcast-style application events. Hooks excel at plugin-style extension points — places where third-party code should be able to modify a value or observe an event without the host knowing who is listening. Both can coexist; pick per use case.

## Can I register multiple callbacks on the same hook?

Yes. They run in priority order; callbacks with the same priority run in the order they were added.

## Does `applyFilters` allocate when no callbacks are registered?

No. The seed value is returned unchanged and the extra-args tuple is not built.

## What happens when I `addAction` during a `doAction`?

The newly-added callback is deferred to the next dispatch. See the *add-during-dispatch semantics* note in [[Actions]].

## How do I test filters?

Pass an initial value to `applyFilters()` in your test and assert the transformed output. See [[Testing]].

## What happens if two copies of the package load?

They share a single registry via a `Symbol.for('@artisanpack-ui/hooks-js/singleton')` slot on `globalThis`, so callbacks registered in copy A fire when dispatched from copy B. That said, you should still configure your bundler to load one copy — see [[Module Federation]].

## Is `window.ApHooks` safe to rely on?

It is the officially documented escape hatch for code that cannot import the package (browser extensions, runtime-injected `<script>`s). Prefer imports where you can, and treat `window.ApHooks` as the compatibility layer.

## Where can I find examples?

The code samples in [[Getting Started]], [[Actions]], [[Filters]], [[React]], and [[Module Federation]] cover the common cases. The package's own test suite (`src/*.test.ts` and `src/react/*.test.tsx`) is the authoritative reference.

---

Return to [[Home]].
