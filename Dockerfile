FROM node:18.12-alpine
WORKDIR /opt/sodium/sodium-transformer
COPY ./ ./
RUN npm ci
