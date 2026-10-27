# Bay Leaf loyalty — single container: API + built web app.
# NOTE: written for a normal build environment with npm registry access. It was not
# built in the original development sandbox (no registry access there).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:5173/api/health || exit 1
CMD ["node", "--import", "tsx", "server/index.ts"]
