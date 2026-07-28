FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @tagery/shared build \
  && pnpm --filter @tagery/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@tagery/web", "start"]
