FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json tsconfig.json ./
RUN npm ci
# Copy prisma from orchestrator if it's shared or needs to be provided
# For now, I'll assume we need to copy it if it exists in the backend root or similar
# Actually, I'll add the prisma generate step
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1
CMD ["node", "dist/index.js"]
