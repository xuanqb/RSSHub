FROM node:16-bullseye

WORKDIR /app

# place ARG statement before RUN statement which need it to avoid cache miss
ARG USE_CHINA_NPM_REGISTRY=1
RUN \
    set -ex && \
    if [ "$USE_CHINA_NPM_REGISTRY" = 1 ]; then \
        echo 'use npm mirror' && \
        npm config set registry https://registry.npmmirror.com && \
        yarn config set registry https://registry.npmmirror.com ; \
    fi; \

COPY ./yarn.lock /app/
COPY ./package.json /app/

RUN yarn install --production --frozen-lockfile

COPY . /app

EXPOSE 1200
CMD ["npm", "run", "start"]
