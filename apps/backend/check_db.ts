import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.count();
  const sales = await prisma.sale.count();
  console.log(`Users: ${users}, Sales: ${sales}`);
  await prisma.$disconnect();
}
main();
