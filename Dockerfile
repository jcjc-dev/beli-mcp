# Build the bundled beli-mcp CLI in a full workspace, then ship a slim runtime image.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
RUN npm ci
RUN npm run build

FROM node:22-alpine AS release
WORKDIR /app
ENV NODE_ENV=production
# The CLI bundles the @beli/* workspace packages; only the SDK + zod stay external.
COPY packages/mcp-server/dist ./dist
COPY packages/mcp-server/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts --no-package-lock \
      @modelcontextprotocol/sdk@^1.29.0 zod@^3.24.1 \
    && npm cache clean --force
ENTRYPOINT ["node", "dist/cli.js"]
