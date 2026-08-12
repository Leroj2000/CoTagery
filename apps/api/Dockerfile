# --- base: build s plnými deps (má ts-node pro migrace i seed) ---
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @tagery/shared build \
  && pnpm --filter @tagery/api build

# --- migrate: spustí migrace + základní seed + demo data, pak skončí ---
# Používá se jako jednorázová služba v docker-compose (běží před API).
FROM base AS migrate
WORKDIR /repo
CMD ["sh", "-c", "pnpm --filter @tagery/api migration:run && pnpm --filter @tagery/api seed && pnpm --filter @tagery/api seed:demo"]

# --- prune: jen produkční závislosti do /out ---
FROM base AS prune
RUN pnpm --filter @tagery/api --prod deploy /out

# --- runtime: štíhlý běhový image API ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prune /out ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
