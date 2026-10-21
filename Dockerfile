# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PHASE=phase-production-build
# El build no abre conexiones, pero algunos módulos leen estas variables al importarse.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build BETTER_AUTH_SECRET=build-time-only-build-time-only-0000 npm run build

# Imagen auxiliar mínima: aplica las migraciones y termina.
FROM base AS migrate
# Solo lo imprescindible para migrar (mismas versiones que la app).
RUN npm init -y >/dev/null && npm i --no-audit --no-fund drizzle-orm@0.45.4 pg@8.23.1
COPY drizzle ./drizzle
COPY scripts ./scripts
CMD ["node", "scripts/migrate.mjs"]

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data/uploads && chown app:app /data/uploads
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
ENV UPLOADS_DIR=/data/uploads
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
