# ─── Stage 1: Install all dependencies ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build frontend (Vite) ──────────────────────────────
FROM deps AS frontend
WORKDIR /app
COPY . .
RUN npm run build

# ─── Stage 3: Build backend (TypeScript → JS) ────────────────────
FROM deps AS backend
WORKDIR /app
COPY server/ server/
COPY prisma/ prisma/
COPY tsconfig.server.json ./
RUN npx prisma generate
RUN npx tsc -p tsconfig.server.json

# ─── Stage 4: Production image ───────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma/ prisma/
RUN npx prisma generate

# Copy built artifacts
COPY --from=frontend /app/dist ./dist
COPY --from=backend /app/server-dist ./server-dist

# Create non-root user and upload directories
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/uploads/avatars /app/uploads/logos /app/uploads/documents /app/uploads/menus /app/uploads/attachments \
    && chown -R appuser:appgroup /app/uploads

USER appuser

EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node server-dist/index.js"]
