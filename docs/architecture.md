# Architecture

## Purpose

This template starts a small Express service that can be copied into API-style Newsday microservices. The default runtime is intentionally thin: one HTTP entry point, one starter router, shared response headers, shared error handling, and structured logging.

## Runtime Flow

1. `index.js` creates the Express app.
2. `morgan`, JSON body parsing, URL-encoded parsing, and cookie parsing are registered globally.
3. `/api` requests pass through `lib/api_headers.js`, then `routes/api.js`, then `lib/api_errors.js` when a route raises an error.
4. `/` returns a simple HTML readiness response.
5. The app listens on port `3000`.

## Modules

- `routes/api.js` is the starter API contract and should be replaced by real service routes.
- `lib/api_headers.js` centralizes JSON content, cache, build-version, and Newsday-origin CORS headers.
- `lib/api_errors.js` centralizes the JSON error envelope.
- `lib/logger.mjs` configures a Winston console logger for container-friendly output.
- `lib/sqs_poller.js` is optional starter code for generated services that consume SQS messages.

## Docker Shape

The image uses `node:22-bookworm-slim`, installs dependencies with Yarn, copies the application, and runs `./start-service`. Non-local builds run webpack during image creation so deployed containers can start `bin/server.js`.

The local Compose file bind-mounts the repository into `/usr/app`, while keeping `/usr/app/node_modules` and `/usr/app/bin` container-owned. This avoids host dependency drift while preserving local edit/watch behavior.

## Template Boundaries

Generated services should keep this shape only where it still fits. Replace the starter route, remove unused optional helpers, document real external dependencies, and add tests for the actual API or queue contract.
