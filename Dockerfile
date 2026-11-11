FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001 DB_PATH=/data/disciplex.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/client/dist ./client/dist
COPY package.json ./
COPY server ./server
VOLUME /data
EXPOSE 3001
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
