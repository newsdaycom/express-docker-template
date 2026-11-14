# Operations

## Purpose

This document records the operational assumptions shipped by the template. Generated services should replace these notes with production-specific runbooks, dashboards, alerts, and rollback steps.

## Health And Readiness

The template exposes:

- `GET /` as a simple HTML readiness page.
- `GET /api` as a starter JSON availability response.

Generated services should add a real health check if they depend on databases, queues, APIs, mounted files, or other runtime resources.

## Logging

`lib/logger.mjs` writes Winston logs to stdout with timestamp, hostname, severity, and JSON formatting by default. `LOG_PRETTY=on` enables local pretty printing. Container platforms should collect stdout/stderr logs.

`morgan('dev')` logs HTTP requests in development-friendly format. Generated services may replace this with structured request logging when needed.

## Deployment

`build-image` publishes a dual-platform index using an environment/source-SHA/UTC tag. Set `REPO_NAME` explicitly. Stage builds must match origin/stage; deploy the verified index digest after qualification.

The Docker build accepts `ENV` and `BUILD_VERSION`. Non-local builds run webpack during image creation and should start through `node --run start`.

## Rollback

The template does not define a deployment platform. Generated services should document:

- Where image tags are deployed.
- How to identify the currently running tag.
- How to roll back to the prior tag.
- Which smoke checks must pass after rollback.

## Incident Notes

Keep service-specific incident response notes outside this template until a real service exists. Once generated, document contacts, log locations, dashboards, alert names, external dependencies, and known failure modes.

## Multi-architecture build contract

The default publication path builds AMD64 and ARM64 together. Stage builds require a clean checkout matching origin/stage, with feature branches based on the canonical release baseline. Use unique build tags and deploy the verified index digest; local OCI/load checks are explicitly separate from publication. See [multi-architecture guide](multiarch.md) for inputs, stage promotion, failure handling and contract tests.
