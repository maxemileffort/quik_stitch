const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Graceful shutdown for Prisma Client
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Prisma Client disconnected due to app termination (SIGINT).');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Prisma Client disconnected due to app termination (SIGTERM).');
  process.exit(0);
});

module.exports = prisma;
