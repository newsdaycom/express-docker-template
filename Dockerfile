FROM node:18-bullseye-slim

RUN mkdir -p /usr/app/bin && chown -R node:node /usr/app
WORKDIR /usr/app

COPY package.json .
COPY yarn.lock .

RUN yarn install

COPY --chown=node:node . .

ARG BUILD_VERSION
ARG ENV

ENV ENV=${ENV}
ENV BUILD_VERSION=${BUILD_VERSION}}
ENV NODE_ENV=${ENV}

USER node

RUN if [ "$ENV" != "local" ]; then yarn build; fi
CMD ["bash", "./start-service"]