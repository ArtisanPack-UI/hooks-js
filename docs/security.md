---
title: Security
---

If you discover a security vulnerability in `@artisanpack-ui/hooks-js`, please do not open a public issue.

See also: [[Contributing]] and [[Changelog]].

## Reporting vulnerabilities

- Contact the maintainer directly at <me@jacobmartella.com> with details and reproduction steps.
- We will coordinate a timeline for a fix and a coordinated release.

## Trust boundaries

Two globals affect runtime behavior and are worth calling out for anyone auditing an application that includes this package:

- `window.__AP_HOOKS_DEBUG__` — enables per-dispatch `console.debug` logging. See [[DevTools Debug]].
- `window.__AP_HOOKS_DEPRECATION_LEVEL__` — controls the level (or silences) deprecation notices. See [[Hook Naming and Deprecations]].

Both are raw globals. Any script sharing the realm can set them — including to `off`, which silences the deprecation audit trail. Set them only from first-party bootstrap code and treat unexpected values as a signal, not a config source.

## Untrusted callbacks

The package does not validate callback identity or origin. If your application allows untrusted code to call `addAction` / `addFilter` (for example, a plugin sandbox that shares the same realm), that code can register callbacks that run on every dispatch. Isolate untrusted plugins in their own realm (worker, iframe) if this is a concern.

---

Return to [[Home]].
