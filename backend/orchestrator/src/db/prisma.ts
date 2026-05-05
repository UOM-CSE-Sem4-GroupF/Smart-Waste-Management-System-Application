import { PrismaClient } from '@prisma/client';

// Singleton pattern — avoids creating multiple connections during hot-reload
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;
