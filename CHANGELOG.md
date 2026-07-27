# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
