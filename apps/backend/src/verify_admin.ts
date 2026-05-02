import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function checkAdmin() {
  const user = await prisma.user.findUnique({
    where: { username: 'admin' }
  });
  
  if (!user) {
    console.log('❌ Usuario admin NO existe');
    return;
  }
  
  console.log('✅ Usuario admin encontrado:', user.username);
  console.log('Activo:', user.activo);
  
  const valid = await bcrypt.compare('123456', user.password_hash);
  console.log('¿Contraseña 123456 es válida?:', valid);
}

checkAdmin().finally(() => prisma.$disconnect());
