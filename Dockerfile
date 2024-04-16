FROM node:18

ARG HOST=gitlab.com
ARG TOKEN=

ENV GITLAB_HOST=$HOST
ENV GITLAB_TOKEN=$TOKEN

WORKDIR /usr/src/gitlab-tools

RUN mkdir out

COPY . .

RUN npm run install-globally