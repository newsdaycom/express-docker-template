# Newsday Express Docker Template

This repository is a reusable starter template for Newsday API-style Express services that run in Docker. It provides a minimal Express app, shared API headers and error handling, structured logging, webpack packaging, local Compose workflow, and starter documentation that should be renamed and narrowed when a real service is created.

## Requirements

- Node.js 22 for parity with `Dockerfile`.
- Yarn, using the committed `yarn.lock`.
- Docker and Docker Compose.
- A local Docker network named `special-projects` for the default Compose workflow.

## Quick Start

```bash
export ENV=local
docker network create special-projects 2>/dev/null || true
bash ./rebuild
```

The service listens on port `3000` inside the container. The starter API response is mounted at `/api`, and the root route returns a simple readiness page.

## Common Commands

```bash
npx eslint .
npx eslint --fix .
node --run build
node --run start
ENV=local bash ./start-service
ENV=local bash ./rebuild
ENV=production bash ./build-image
```

`package.json` does not currently define a test command. Generated services should add a test runner before they grow real behavior, then document that command in `docs/testing.md`.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ENV` | Yes | None | Controls local versus packaged startup and Docker build mode. Use `local` for development and `production` for deployed runtime. |
| `BUILD_VERSION` | No | `local-build` in Compose | Exposed through the `x-build-version` API response header. |
| `NODE_ENV` | No | `${ENV}` in Compose | Standard Node environment value. |
| `NODE_OPTIONS` | No | `--enable-source-maps` in Compose | Enables useful stack traces from bundled code. |
| `LOG_LEVEL` | No | `info` | Minimum Winston log severity. |
| `LOG_PRETTY` | No | `on` in Compose | Enables local pretty logging. |

## Repository Structure

| Path | Purpose |
| --- | --- |
| `index.js` | Express application entry point and HTTP listener. |
| `routes/api.js` | Starter `/api` router. |
| `lib/api_headers.js` | Shared JSON, cache, build-version, and Newsday CORS headers. |
| `lib/api_errors.js` | Shared JSON error response middleware. |
| `lib/logger.mjs` | Shared Winston logger. |
| `lib/sqs_poller.js` | Optional SQS polling helper for generated queue consumers. |
| `webpack.config.js` | Node bundle, lint, minification, and nodemon watch configuration. |
| `Dockerfile` | Production-ready Node image definition. |
| `docker-compose.yaml` | Local Compose service definition. |
| `build-image` | Timestamped image build and push script. |
| `rebuild` | Local rebuild/recreate/log-follow helper. |
| `start-service` | Local watch versus packaged startup selector. |
| `docs/` | Durable architecture, configuration, development, operations, testing, and API notes. |

## Creating A Real Service

Search for `express-docker-template`, `DOCKERHUBUSER/REPO_NAME`, and `local-build`, then replace every inherited placeholder that is no longer accurate. Remove starter routes, optional helpers, dependencies, and docs sections that do not apply to the generated service.

Before first handoff, run the documented quick start, Docker build, startup path, lint command, and baseline tests. Update this README and `docs/` with the exact commands that passed.

## Local Proxy Access

In the Newsday local proxy environment, add a route to `local.tools.newsday.com.conf` that points at the Compose hostname for the generated service:

```nginx
location ~ /<preferred URL for microservice>(.*) {
    proxy_set_header HTTP_X_FORWARDED_PROTO https;
    set $upstream http://<hostname>:3000$1$is_args$args;
    proxy_pass  $upstream;
}
```

Restart the local proxy/Docker environment after changing the nginx config, run `ENV=local bash ./rebuild`, then visit the configured local URL.

## Troubleshooting

- Missing `special-projects` network: run `docker network create special-projects`.
- Missing `ENV`: export `ENV=local` before `rebuild` or `start-service`.
- Dependency mismatch: run `ENV=local bash ./rebuild` so dependencies install inside the image.
- Build or lint failure: run `npx eslint .` first, then `node --run build` for the webpack path.

## Ownership

This template is intended for Newsday service teams. Generated projects should replace this section with the real owner, support path, and project-specific runbooks.
