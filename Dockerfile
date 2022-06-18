FROM node:18-bullseye-slim

WORKDIR /usr/app

COPY package.json .
COPY yarn.lock .

RUN yarn install

COPY . .

ARG BUILD_VERSION
ARG ENV

ENV ENV=${ENV}
ENV BUILD_VERSION=${BUILD_VERSION}}

RUN if [[ "$ENV" != "local" ]]; then yarn build; fi

USER node
CMD ["bash", "./start-service"]