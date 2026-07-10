# Purpose:
#   Build a reproducible Node.js container for services generated from this
#   Express template.
#
# Inputs:
#   BUILD_VERSION identifies the image/application version exposed by API
#   headers. ENV controls local versus packaged runtime behavior.
#
# Side Effects:
#   Installs Yarn dependencies, optionally builds the production bundle, and
#   starts the service through ./start-service.
FROM node:22-bookworm-slim

# Set up writable application directories before dropping to the non-root user.
RUN mkdir -p /usr/app/bin && mkdir -p /usr/app/node_modules && chown -R node:node /usr/app

# Run all following commands from the application root inside the image.
WORKDIR /usr/app

# Keep image runtime behavior aligned with least-privilege container defaults.
USER node

# Dependencies live in their own layer so rebuilds can reuse the install cache
# when only application source files change.

COPY --chown=node:node package.json .
COPY --chown=node:node yarn.lock .

RUN yarn install --frozen-lockfile

# Copy source after dependency installation to preserve the dependency layer.
COPY --chown=node:node . .

# Build arguments become runtime environment values so routes and logs can
# expose deployment context without hardcoding environment-specific settings.
ARG BUILD_VERSION
ARG ENV

ENV ENV=${ENV}
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NODE_ENV=${ENV}

# Non-local images run the webpack production build during image creation.
RUN if [ "$ENV" != "local" ]; then node --run build; fi

# Delegate local versus packaged startup behavior to the template script.
CMD ["bash", "./start-service"]
