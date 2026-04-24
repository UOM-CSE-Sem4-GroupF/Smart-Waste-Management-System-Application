FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# Copy Python bridge alongside compiled JS so __dirname resolves correctly
RUN cp src/kafka/bridge.py dist/kafka/bridge.py

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Python + kafka-python needed for the Kafka bridge subprocess
RUN apk add --no-cache python3 py3-pip && \
    pip3 install kafka-python python-dotenv --break-system-packages --quiet
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3099
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3099}/health || exit 1
CMD ["node", "dist/index.js"]