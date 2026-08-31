# Development

## Purpose

This document describes the local workflow for maintaining the Express Docker template or a generated service that still follows the template structure.

## Local Startup

```bash
export ENV=local
docker network create special-projects 2>/dev/null || true
bash ./rebuild
```

`rebuild` rebuilds the Compose image, recreates the container, starts it, and follows logs. In local mode, `start-service` runs `node --run dev`, which starts webpack watch mode and nodemon.

## Linting And Formatting

```bash
npx eslint .
yarn test
npx eslint --fix .
```

The `dev` script also runs `npx eslint --fix .` before webpack watch mode. Generated services should keep lint behavior documented if they replace ESLint, Prettier, or webpack.

## Build Paths

```bash
node --run build
node --run start
```

`node --run build` runs ESLint and creates the production webpack bundle in `bin/server.js`. `node --run start` runs that bundle and should be used only after the bundle exists.

## Dependency Management

Use Yarn and commit `yarn.lock` changes with dependency updates. Rebuild the Docker image after dependency changes so container dependencies and the lockfile stay aligned.

## Generated Service Cleanup

When creating a real service:

- Rename `express-docker-template` placeholders.
- Replace `DOCKERHUBUSER/REPO_NAME` in `build-image`.
- Replace the starter `/api` route with the real contract.
- Keep `lib/redis_streams.mjs` and `lib/redis_delayed_scheduler.mjs` for queue services, then rename stream keys, consumer groups, and delayed sorted-set names.
- Delete `lib/sqs_poller.js` unless the service is temporarily draining old SQS messages.
- Update README and `docs/` with real commands, owners, ports, routes, and deployment details.
