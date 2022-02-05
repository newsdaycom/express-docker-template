# Newsday Express/Docker template

Microservices are becoming the name of the game. Much what we are building are API-only microservices. Here's a template to get started quickly!

## File descriptions

**build-image** | This script will bake a fresh docker image with all of your code and push it to docker hub using the current timestamp as a tag

**rebuild** | Helpful for rebuilding your docker container locally to rule out issues with missing packages or scrambled mounts due to branch changes.
