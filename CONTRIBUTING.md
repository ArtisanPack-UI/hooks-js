# Contributing to `@artisanpack-ui/hooks-js`

Thanks for taking the time to contribute! This document covers everything you need to make a change land in this repository.

## Ground rules

- **Security issues stay private.** Email <me@jacobmartella.com> instead of opening a public issue. See [`docs/security.md`](./docs/security.md).
- **The API mirrors the PHP twin.** `@artisanpack-ui/hooks-js` is intentionally the JavaScript companion to [`artisanpack-ui/hooks`](https://github.com/ArtisanPack-UI/hooks) — same function names, same priority semantics, same deprecation model. Behavior changes that would diverge from the PHP twin need explicit discussion in an issue first.
- **Public API changes** — new exports, changed signatures, changed default behavior — require a `CHANGELOG.md` entry and a matching update to the docs under `/docs`.

## Development setup

Prerequisites:

- Node.js **20+**
- npm 10+ (bundled with Node 20)

Clone and install:

```bash
git clone https://github.com/ArtisanPack-UI/hooks-js.git
cd hooks-js
npm install
```

## Scripts

| Command                     | What it does                                                              |
| --------------------------- | ------------------------------------------------------------------------- |
| `npm run build`             | Build with tsup (`dist/*.mjs`, `dist/*.cjs`, `dist/*.d.ts`).              |
| `npm run clean`             | Remove the `dist/` directory.                                             |
| `npm test`                  | Run the Vitest suite once (jsdom env).                                    |
| `npm run test:watch`        | Vitest in watch mode.                                                     |
| `npm run test:coverage`     | Vitest with `@vitest/coverage-v8`. Enforces per-file thresholds in CI.    |
| `npm run lint`              | ESLint over `src/**/*.{ts,tsx}`.                                          |
| `npm run type-check`        | `tsc --noEmit` against the source tree.                                   |
| `npm run format`            | Prettier — write mode.                                                    |
| `npm run format:check`      | Prettier — check mode. This is what CI runs.                              |

Before pushing, run at minimum:

```bash
npm run lint && npm run type-check && npm test
```

If you touched any code paths, also run:

```bash
npm run test:coverage
```

Coverage thresholds enforced in CI: **95%+ on the core, 90%+ on the React adapter.**

## Code style

- **TypeScript everywhere.** Source is `.ts` / `.tsx`; no plain `.js` files.
- **Prettier** for formatting. Run `npm run format` before committing, or configure your editor to format on save with the repo config.
- **ESLint** with `typescript-eslint` and `eslint-plugin-react-hooks`. Warnings from these plugins must be resolved, not suppressed.
- **Named exports only.** No default exports anywhere in `src/`.
- **No comments unless the *why* is non-obvious.** Well-named identifiers cover the *what*. Reserve comments for hidden constraints, invariants, or workarounds.

## Testing conventions

- Every public function has a test. New exports without tests will not be merged.
- Tests live next to source: `src/actions.ts` → `src/actions.test.ts`. React tests use `.test.tsx`.
- Use Vitest's globals (`describe`, `it`, `expect`, `afterEach`, `vi`).
- Isolate hook state between tests — call `removeAllActions(hook)` / `removeAllFilters(hook)` in `afterEach`, or reset the registry directly.
- For React tests, use `@testing-library/react` and wrap out-of-render registry mutations in `act(...)`.
- For deprecation tests, call `resetDeprecationLogState()` in `beforeEach` and spy on `console.info` (or the level you're testing) to keep test output clean.

See [`docs/testing.md`](./docs/testing.md) for more testing recipes.

## Documentation

- Long-form docs live under `/docs`. Each page has YAML frontmatter:

  ```markdown
  ---
  title: Page Title
  ---
  ```

- Subdirectories require a companion `<name>.md` file at the parent level (for example, `docs/react/` has a matching `docs/react.md` "home" page). This mirrors the convention used across ArtisanPack UI packages.
- Cross-link with GitLab-wiki-style `[[Page Title]]` links, or with relative Markdown links (`[text](./relative/path.md)`) when the page is embedded on GitHub.
- The `README.md` is the source of truth for the quickstart and the top-level API surface. `/docs/home.md` is the entry point for the deep-dive tree.
- Any public API change requires a matching docs update in the same PR.

## Pull request conventions

- **Branch off `release/1.0`** for 1.x work. Branch off `main` only for post-1.0 changes.
- **Branch naming**: `feature/<issue#>-<slug>`, `bugfix/<issue#>-<slug>`, `docs/<issue#>-<slug>`, etc. — one issue per branch.
- **Commit style**: conventional-commit prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`) followed by an imperative summary. Reference the issue at the end of the commit body with `Closes #<n>` when applicable.
- **One logical change per PR.** If a change grows to touch unrelated areas, split it.
- **PR description** should:
  - Summarize the change and its motivation.
  - Link the closing issue.
  - Call out any public-API changes, behavioral changes, or breaking changes.
  - List the test / lint / type-check commands you ran locally.
- **CI must be green** before review. Fix hook / test / lint failures locally rather than pushing "fix CI" commits.
- Draft PRs are welcome for early feedback — mark ready for review only when the checklist above is satisfied.

## Reporting bugs

Open a GitHub issue with:

- A minimal reproduction (a code snippet or a link to a repo).
- Expected vs. actual behavior.
- Package version (`npm ls @artisanpack-ui/hooks-js`).
- Environment (Node version, browser, bundler).

If the bug involves Module Federation or the `globalThis.ApHooks` escape hatch, please include the bundler config that reproduces it — that's the fastest path to a fix.

## Release process (maintainers)

1. Update `CHANGELOG.md` — move entries from `[Unreleased]` under a new dated version heading.
2. Bump `version` in `package.json`.
3. Update `VERSION` in `src/index.ts` to match.
4. Tag the release commit (`git tag vX.Y.Z`) and push tags.
5. `npm run clean && npm run build`.
6. `npm publish` (with 2FA).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
