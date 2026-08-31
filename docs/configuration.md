# Configuration

## Purpose

This document records the template's environment variables, Docker build arguments, and configuration assumptions. Generated services should replace template examples with their real required settings before handoff.

## Environment Variables

| Variable | Required | Local Example | Notes |
| --- | --- | --- | --- |
| `ENV` | Yes | `local` | Controls `start-service` behavior and webpack optimization. Use `local` for development and `production` for deployed runtime. |
| `BUILD_VERSION` | No | `local-build` | Returned by API responses in the `x-build-version` header. Deployed builds should pass a real image or release tag. |
| `NODE_ENV` | No | `local` | Standard Node runtime hint. Compose mirrors `ENV` by default. |
| `NODE_OPTIONS` | No | `--enable-source-maps` | Enables useful stack traces from bundled code. |
| `LOG_LEVEL` | No | `info` | Minimum log level for Winston. |
| `LOG_PRETTY` | No | `on` | Enables pretty-printed local logs. Leave off for production JSON logs. |
| `REDIS_URL` | Queue services | `redis://redis:6379` | Redis or Valkey connection URL. Local Compose may use insecure Redis. Stage and production must inject secure `rediss://` Valkey URLs through environment variables. |
| `REDIS_STREAM_PREFIX` | No | `local` | Optional namespace for stream keys. |
| `REDIS_CONSUMER_GROUP` | Consumers | `example-service` | Redis Streams consumer group. |
| `REDIS_CONSUMER_NAME` | No | `example-service-local` | Consumer instance name; helpers default to hostname and pid when omitted. |
| `REDIS_BLOCK_MS` | No | `5000` | Blocking read duration for XREADGROUP. |
| `REDIS_BATCH_SIZE` | No | `10` | Maximum messages per consumer read or scheduler promotion batch. |
| `REDIS_PENDING_IDLE_MS` | No | `60000` | Idle threshold before pending messages are claimed. |
| `REDIS_SCHEDULED_SET` | Delayed jobs | `local:scheduled-jobs` | Sorted-set key that stores delayed records by due timestamp. |

## Docker Build Arguments

| Argument | Purpose |
| --- | --- |
| `ENV` | Selects local versus production build behavior. |
| `BUILD_VERSION` | Stamps the runtime with a version surfaced by API headers. |
| `TARGETENV` | Currently passed by `build-image` for compatibility with generated services that may need it. |

## Secrets

The template does not include secrets. Generated services must keep secrets out of Docker images, Compose files, scripts, and committed docs. Use runtime environment variables or the deployment platform's secret mechanism, then document the names and expected formats here.

## Redis Streams / Valkey

`lib/redis_streams.mjs` is the default queue helper for generated services. It reads `REDIS_URL` only when opening a real Redis connection; tests and service modules may inject a compatible client. Runtime source should not hardcode Redis, Valkey, Search API, or production connection values.

`lib/redis_delayed_scheduler.mjs` uses `REDIS_SCHEDULED_SET` for delayed jobs. Scheduled records store due timestamps as sorted-set scores and promote due entries into target streams under per-record locks.

## Legacy SQS Configuration

`lib/sqs_poller.js` is legacy/drain-only starter code. New services should use Redis Streams. Services that must drain old queues during a migration may keep the helper temporarily, but should not publish new SQS messages and should document removal criteria.
