FROM node:16-bullseye

WORKDIR /app

COPY ./yarn.lock /app/
COPY ./package.json /app/

RUN yarn install --production --frozen-lockfile

COPY . /app

EXPOSE 1200
CMD ["npm", "run", "start"]
