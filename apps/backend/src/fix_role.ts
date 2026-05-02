import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixRole() {
  await prisma.user.update({
    where: { username: 'admin' },
    data: { role: 'SUPERADMIN' }
  });
  console.log('✅ Rol de admin actualizado a SUPERADMIN');
}

fixRole().finally(() => prisma.$disconnect());
