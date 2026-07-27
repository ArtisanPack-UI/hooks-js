# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cross-module state singleton keyed by `Symbol.for('@artisanpack-ui/hooks-js/singleton')`
  on `globalThis`. Duplicate copies of the package (Module Federation without
  `shared: { singleton: true }`) now share one registry so callbacks registered
  under one copy fire when dispatched from another.
- `globalThis.ApHooks` public-API escape hatch installed on first import of the
  entry module. Plugins loaded outside the bundler graph can call
  `window.ApHooks.addAction(...)` / `.applyFilters(...)` without importing the
  package; calls share state with the imported API.
- DevTools debug flag `window.__AP_HOOKS_DEBUG__ = true` — logs each `doAction`
  / `applyFilters` dispatch to `console.debug` with the hook name, a compact
  argument preview, and the current subscriber count. Read per-dispatch so it
  can be toggled from DevTools without reloading.
- README section documenting `shared: { singleton: true, strictVersion: false }`
  for `@originjs/vite-plugin-federation`, webpack `ModuleFederationPlugin`, and
  Rspack, plus a plugin `bootModule` recipe for pre-mount hook registration.
- Vitest v8 coverage config with per-file thresholds (95%+ core, 90%+ React
  adapter) wired into CI via `npm run test:coverage`.
- Expanded test suite: `removeAll{Actions,Filters}` with a specific priority
  edge cases, add-during-dispatch deferral semantics, `applyFilters` returning
  seed value when no subscribers, cross-alias dedup for identical bound
  methods, React adapter sibling-unmount isolation, StrictMode
  no-double-registration.
- Initial repository scaffold: TypeScript, tsup, Vitest (jsdom), ESLint, Prettier,
  GitHub Actions CI matrix (Node 20 / 22), and dual entry points (`.` + `./react`).
- `deprecateHook(oldName, newName)` with chain collapse, cycle detection, and
  cross-bucket dedup on dispatch. `addAction`/`addFilter` on an alias silently
  attach to the canonical bucket; `doAction`/`applyFilters` fire callbacks
  registered under either name exactly once. Deprecation notices log once per
  alias per session at the level configured via
  `window.__AP_HOOKS_DEPRECATION_LEVEL__` (`off` / `debug` / `info` / `warn` /
  `error`, defaults to `info`). Helpers: `hasAliases()`, `aliasesFor(canonical)`,
  `resetDeprecationLogState()`.
- React adapter (`@artisanpack-ui/hooks-js/react`): `useFilter`, `useAction`,
  `useHookedChildren`, and `<HookSlot>`. Backed by `useSyncExternalStore` on a
  per-hook version counter that bumps on every registry mutation, including
  changes on any reverse-alias bucket. `useAction` deep-compares args to avoid
  re-firing on freshly-allocated but semantically-equal tuples. SSR-safe:
  server render never subscribes, and callbacks registered in `useEffect`
  attach on hydrate.
