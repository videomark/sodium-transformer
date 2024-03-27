FROM node:20.12-alpine@sha256:ef3f47741e161900ddd07addcaca7e76534a9205e4cd73b2ed091ba339004a75
WORKDIR /opt/sodium/sodium-transformer
COPY ./ ./
RUN npm ci
