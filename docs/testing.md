# Testing

## Purpose

This document defines the current validation path for the template and the expected testing standard for generated services.

## Current Template Checks

```bash
npx eslint .
yarn test
node --run build
```

`yarn test` uses Node's built-in test runner and currently covers Redis stream publishing, consumer parsing, acknowledgement, pending-message recovery, delayed scheduler due/not-due behavior, and idempotency keys.

## Generated Service Expectations

Generated services should add tests as soon as they introduce real behavior. Prefer:

- Unit tests for pure helpers and configuration parsing.
- Express integration tests for routes, middleware, status codes, headers, and JSON envelopes.
- Docker startup smoke tests for runtime packaging and environment wiring.
- Regression tests for fixed bugs, external contracts, queue parsing, or risky integrations.

Redis/Valkey integrations should keep pure unit tests with injected clients, then add Docker or environment-backed smoke tests where service risk warrants it.

## Regression Battery

Create `tests/regression/` or a documented service-specific equivalent when a generated service has stable behavior to protect. Keep fixtures small and safe to commit. Document any large or sensitive fixture retrieval steps here instead of committing those files.

## Docker Validation

For Docker-sensitive changes, run:

```bash
export ENV=local
bash ./rebuild
```

If the full Compose path is too expensive for a small source-only change, report the narrower validation that was run and why the Docker path was skipped.
