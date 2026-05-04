import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedOperationalCatalogs } from './catalogSeed'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!', 10)
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: passwordHash,
      role: 'SUPERADMIN',
      nombre: 'Super Administrador'
    },
  })
  
  console.log({ admin })

  await seedOperationalCatalogs(prisma)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
