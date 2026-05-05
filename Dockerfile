FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY .next ./.next
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
