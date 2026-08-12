FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @tagery/shared build

# NEXT_PUBLIC_* se v Nextu bakuje při BUILDU (čte ho i prohlížeč na veřejných
# stránkách /s a /activate) → musí být veřejná URL API, ne localhost.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @tagery/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@tagery/web", "start"]
