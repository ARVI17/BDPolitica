FROM node:20-slim AS base
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @bdpolitica/web... --frozen-lockfile=false

FROM deps AS dev
COPY apps/web apps/web
EXPOSE 3000
CMD ["pnpm", "--filter", "@bdpolitica/web", "dev"]
