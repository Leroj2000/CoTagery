# --- build ---
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @tagery/shared build \
  && pnpm --filter @tagery/api build \
  && pnpm --filter @tagery/api --prod deploy /out

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
