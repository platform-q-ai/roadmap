FROM node:22.13-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build:ts

EXPOSE 3000

USER node
CMD ["npm", "start"]
