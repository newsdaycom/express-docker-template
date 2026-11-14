# Testing

## Purpose

This document defines the current validation path for the template and the expected testing standard for generated services.

## Current Template Checks

```bash
npx eslint .
node --run build
```

The repository does not currently include a unit test runner or a `test` script. Until generated services add behavior beyond the starter routes and middleware, lint and webpack build are the baseline checks.

## Generated Service Expectations

Generated services should add tests as soon as they introduce real behavior. Prefer:

- Unit tests for pure helpers and configuration parsing.
- Express integration tests for routes, middleware, status codes, headers, and JSON envelopes.
- Docker startup smoke tests for runtime packaging and environment wiring.
- Regression tests for fixed bugs, external contracts, queue parsing, or risky integrations.

## Regression Battery

Create `tests/regression/` or a documented service-specific equivalent when a generated service has stable behavior to protect. Keep fixtures small and safe to commit. Document any large or sensitive fixture retrieval steps here instead of committing those files.

## Docker Validation

For Docker-sensitive changes, run:

```bash
export ENV=local
bash ./rebuild
```

If the full Compose path is too expensive for a small source-only change, report the narrower validation that was run and why the Docker path was skipped.

## Multi-architecture build contract

The default publication path builds AMD64 and ARM64 together. Stage builds require a clean checkout matching origin/stage, with feature branches based on the canonical release baseline. Use unique build tags and deploy the verified index digest; local OCI/load checks are explicitly separate from publication. See [multi-architecture guide](multiarch.md) for inputs, stage promotion, failure handling and contract tests.
