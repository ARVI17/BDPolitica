FROM node:20-slim AS base
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @bdpolitica/api... --frozen-lockfile=false

FROM deps AS dev
COPY apps/api apps/api
COPY docs docs
EXPOSE 3001
CMD ["pnpm", "--filter", "@bdpolitica/api", "dev"]
