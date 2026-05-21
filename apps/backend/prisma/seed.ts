import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedOperationalCatalogs } from './catalogSeed'

const prisma = new PrismaClient()

async function upsertPrimarySuperadmin() {
  const username = process.env.SEED_SUPERADMIN_USERNAME?.trim()
  const password = process.env.SEED_SUPERADMIN_PASSWORD
  const nombre = process.env.SEED_SUPERADMIN_NAME?.trim() || 'Super Administrador Fuvex'

  if (!username || !password) {
    return null
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      password_hash: passwordHash,
      role: 'SUPERADMIN',
      nombre,
      activo: true
    },
    create: {
      username,
      password_hash: passwordHash,
      role: 'SUPERADMIN',
      nombre,
      activo: true
    },
  })

  return { username: user.username, role: user.role, activo: user.activo }
}

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
  
  console.log({ admin: { username: admin.username, role: admin.role, activo: admin.activo } })

  const primarySuperadmin = await upsertPrimarySuperadmin()
  if (primarySuperadmin) {
    console.log({ primarySuperadmin })
  }

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
