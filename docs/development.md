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
- Set `REPO_NAME` to the generated service image repository when invoking `build-image`.
- Replace the starter `/api` route with the real contract.
- Delete `lib/sqs_poller.js` if the service does not consume SQS.
- Update README and `docs/` with real commands, owners, ports, routes, and deployment details.

## Standard multi-architecture image builder

Services adopt this template's existing build-image, changing only the image
identifier. Keep common build logic in the template; developer direction is
required for other application-specific deviations. One Buildx invocation builds
linux/amd64 and linux/arm64 together and verifies the published index.

Before committing application build changes, build the uncommitted candidate
using BUILD_QUALIFICATION=1 with a loopback REPO_NAME or local OCI/load output,
then execute the resulting ARM64 image under emulation and verify AMD64. Dirty
candidates carry explicit dirty provenance and are not stage deployment artifacts.
Commit, push and open the application PR after successful qualification. Clean
stage deployment publication still uses the recorded origin/stage revision.
