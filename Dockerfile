FROM node:18

WORKDIR /usr/src/gitlab-tools

RUN mkdir out

COPY . .

RUN npm run install-globally