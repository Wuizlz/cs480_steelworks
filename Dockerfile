FROM node:20-alpine AS builder

WORKDIR /app

# Disable Husky during container builds.
ENV HUSKY=0

# Frontend Vite env vars are baked into the bundle at build time.
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

# Install dependencies first to maximize Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the full repo after dependencies are cached.
COPY . .

# Build the backend and frontend, then remove devDependencies.
RUN npm run build \
  && npm run build:ui \
  && npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only the files needed at runtime.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
