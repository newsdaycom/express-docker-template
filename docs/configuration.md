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

## Docker Build Arguments

| Argument | Purpose |
| --- | --- |
| `ENV` | Selects local versus production build behavior. |
| `BUILD_VERSION` | Stamps the runtime with a version surfaced by API headers. |
| `TARGETENV` | Currently passed by `build-image` for compatibility with generated services that may need it. |

## Secrets

The template does not include secrets. Generated services must keep secrets out of Docker images, Compose files, scripts, and committed docs. Use runtime environment variables or the deployment platform's secret mechanism, then document the names and expected formats here.

## Optional SQS Configuration

`lib/sqs_poller.js` includes placeholder queue URLs keyed by `local`, `stage`, and `prod`. Services that keep this helper must provide real queue URLs through code-level configuration or a documented environment mapping. HTTP-only services should delete the helper and remove any unused dependencies.
