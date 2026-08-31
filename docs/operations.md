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

## Redis Streams Operations

Queue-oriented generated services should use Redis Streams/Valkey as the default queue transport. Operators should monitor stream length, consumer-group lag, pending entries, retry/claim counts, and delayed sorted-set size.

Pending entries can be replayed by allowing the service's consumer to call pending recovery. The helper uses `XAUTOCLAIM` when the server supports it and falls back to `XPENDING` plus `XCLAIM` for older Redis-compatible runtimes.

Delayed jobs are stored in `REDIS_SCHEDULED_SET` with due timestamps as scores. Multiple scheduler instances can run together because promotion uses a short-lived per-record lock before writing to the target stream.

Local Compose uses `redis://redis:6379`. Stage and production deployments must supply secure `rediss://` Valkey connection strings through runtime environment variables. Do not commit production hostnames, credentials, or tokens.

## Deployment

`build-image` creates a timestamped tag based on the current branch and pushes it to `REPO_NAME`. Replace `DOCKERHUBUSER/REPO_NAME` before any generated service uses the script.

The Docker build accepts `ENV` and `BUILD_VERSION`. Non-local builds run webpack during image creation and should start through `node --run start`.

## Rollback

The template does not define a deployment platform. Generated services should document:

- Where image tags are deployed.
- How to identify the currently running tag.
- How to roll back to the prior tag.
- Which smoke checks must pass after rollback.

## Incident Notes

Keep service-specific incident response notes outside this template until a real service exists. Once generated, document contacts, log locations, dashboards, alert names, external dependencies, and known failure modes.
