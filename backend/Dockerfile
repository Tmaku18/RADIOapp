# Build stage
# Node 22+ is required: @supabase/realtime-js needs the native WebSocket
# global to publish station events (queue_updated, DJ transport) from the
# server. On Node 20 every broadcast is silently dropped.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run stage
FROM node:22-alpine

WORKDIR /app

# System ffmpeg is required for Discover/sample trims. The npm ffmpeg-static
# binary is glibc-based and often fails on Alpine/musl at runtime.
RUN apk add --no-cache ffmpeg

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
