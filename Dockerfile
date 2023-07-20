FROM node:20.4-alpine@sha256:8165161b6e06ec092cf5d02731e8559677644845567dbe41b814086defc8c261
WORKDIR /opt/sodium/sodium-transformer
COPY ./ ./
RUN npm ci
