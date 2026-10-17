# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Alle Abhängigkeiten inkl. Build-Werkzeuge (better-sqlite3 ist ein natives Modul)
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/sticker-plot.db \
    TZ=Europe/Berlin
COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
# Chromium (nur Headless-Shell) passend zur Playwright-Version samt Systembibliotheken
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata fonts-dejavu-core \
  && npx playwright-core install --with-deps --only-shell chromium \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build ./build
COPY server.mjs ./
COPY drizzle ./drizzle
COPY scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
