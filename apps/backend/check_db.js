const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.user.findMany({
    select: { role: true },
    distinct: ['role'],
  });
  console.log('Roles found:', roles.map(r => r.role));

  const plazas = await prisma.sale.findMany({
    select: { plaza: true },
    distinct: ['plaza'],
  });
  console.log('Plazas found:', plazas.map(p => p.plaza));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
