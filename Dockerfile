FROM node:16-slim

ENV NODE_OPTIONS "--insecure-http-parser"

WORKDIR /usr/app

COPY package.json .
COPY yarn.lock .
RUN yarn install --only=prod

COPY . .

USER node
CMD ["bash", "./start-service"]