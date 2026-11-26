# Build context phải là thư mục gốc repo (.) để copy được docs/smartstock_api.yaml cho Swagger UI
FROM node:22-alpine AS builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app/backend

ENV NODE_ENV=development

COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY backend/db/migration ./db/migration
COPY backend/scripts ./scripts
COPY docs/smartstock_api.yaml /app/docs/smartstock_api.yaml

EXPOSE 4000

CMD ["sh", "-c", "npx tsx scripts/migrate.ts && node dist/server.js"]
