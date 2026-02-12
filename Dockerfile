# ── Stage 1: Build ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build


# ── Stage 2: Production ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy API edge functions (used by server.js at runtime)
COPY api/ ./api/

# Copy server entry point
COPY server.js ./

# Copy static data files
COPY data/ ./data/
COPY public/ ./public/

# Expose port
ENV PORT=3000
EXPOSE 3000

# Health check (use 127.0.0.1 — Alpine resolves localhost to IPv6 [::1] which the server doesn't bind)
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start server
CMD ["node", "server.js"]
