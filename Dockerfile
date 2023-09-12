FROM node:16-bullseye as dep-builder
# Here we use the non-slim image to provide build-time deps (compilers and python), thus no need to install later.
# This effectively speeds up qemu-based cross-build.

# no longer needed
#RUN ln -sf /bin/bash /bin/sh

WORKDIR /app

# place ARG statement before RUN statement which need it to avoid cache miss
ARG USE_CHINA_NPM_REGISTRY=1
RUN \
    set -ex && \
    if [ "$USE_CHINA_NPM_REGISTRY" = 1 ]; then \
        echo 'use npm mirror' && \
        npm config set registry https://registry.npmmirror.com && \
        yarn config set registry https://registry.npmmirror.com ; \
    fi;

COPY ./yarn.lock /app/
COPY ./package.json /app/

# lazy install Chromium to avoid cache miss, only install production dependencies to minimize the image size
RUN \
    set -ex && \
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true && \
    yarn install --production --frozen-lockfile --network-timeout 1000000 && \
    yarn cache clean

COPY . /app

EXPOSE 1200
CMD ["npm", "run", "start"]
