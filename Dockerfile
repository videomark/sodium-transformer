FROM node:19.0-alpine@sha256:1a04e2ec39cc0c3a9657c1d6f8291ea2f5ccadf6ef4521dec946e522833e87ea
WORKDIR /opt/sodium/sodium-transformer
COPY ./ ./
RUN npm ci
