import { PrismaClient } from '@prisma/client';
import { seedOperationalCatalogs } from '../prisma/catalogSeed';

const prisma = new PrismaClient();

seedOperationalCatalogs(prisma)
  .catch((error) => {
    console.error('Error durante el seeding de documentos requeridos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
