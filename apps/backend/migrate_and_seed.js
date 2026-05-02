const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration...');
  
  // 1. Map Plaza to Departamento (Lima -> LIMA)
  const result = await prisma.sale.updateMany({
    where: {
      OR: [
        { plaza: 'Lima' },
        { plaza: 'LIMA' },
        { departamento: null }
      ]
    },
    data: {
      departamento: 'LIMA'
    }
  });
  
  console.log(`Updated ${result.count} records with departamento = 'LIMA'`);
  
  // 2. Create some sample goals for testing if they don't exist
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL']
      }
    }
  });
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  for (const user of users) {
    const goalAmount = user.role === 'VENDEDOR' ? 100000 : (user.role === 'SUPERVISOR' ? 500000 : 2000000);
    
    await prisma.goal.upsert({
      where: {
        user_id_month_year: {
          user_id: user.id,
          month: currentMonth,
          year: currentYear
        }
      },
      update: {},
      create: {
        user_id: user.id,
        amount: goalAmount,
        month: currentMonth,
        year: currentYear
      }
    });
  }
  
  console.log('Seed data for goals created/updated.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
