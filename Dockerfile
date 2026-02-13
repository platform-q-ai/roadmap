FROM node:22.13-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build:ts

# Ensure the fallback db directory is writable by the non-root user.
# When DB_PATH is set (e.g. /data/architecture.db on a persistent disk),
# this directory is unused but harmless.
RUN mkdir -p db && chown node:node db

EXPOSE 3000

USER node
CMD ["npm", "start"]
