# syntax=docker/dockerfile:1.7

# ---- build: install everything, compile client + server ------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: production dependencies, non-root, nothing else -------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5000
WORKDIR /app

# The app runs with plain `node`, so drop the package managers bundled with the
# base image: less attack surface, and none of npm's own dependency CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg

# AWS RDS certificate bundle, so the app verifies the database's TLS certificate
# (DATABASE_URL uses sslmode=verify-full&sslrootcert=/app/certs/rds-global-bundle.pem).
ADD --chmod=444 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem

COPY --from=build --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=root:root /app/migrations ./migrations
COPY --from=build --chown=root:root /app/package.json ./package.json

# Files are owned by root and read-only for the app user; it can't modify its own code.
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "dist/index.js"]
