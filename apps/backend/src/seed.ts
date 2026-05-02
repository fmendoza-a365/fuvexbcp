import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ⚠️ SOLO PARA DESARROLLO — Cambiar en producción
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const password_hash = await bcrypt.hash(seedPassword, 10);

  // 1. Zonas
  const zoneLimaNorte = await prisma.zone.create({
    data: { nombre: 'Lima Norte', departamento: 'Lima', distrito: 'Los Olivos' }
  });
  const zoneLimaSur = await prisma.zone.create({
    data: { nombre: 'Lima Sur', departamento: 'Lima', distrito: 'Surco' }
  });

  // 2. Roles Globales
  const superadmin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'SUPERADMIN', password_hash, nombre: 'Super Administrador' },
    create: { username: 'admin', nombre: 'Super Administrador', password_hash, role: 'SUPERADMIN' }
  });

  const gerente = await prisma.user.create({
    data: { username: 'gerente1', nombre: 'Gerente General', password_hash, role: 'GERENTE' }
  });

  const backoffice = await prisma.user.create({
    data: { username: 'backoffice1', nombre: 'Juan BackOffice', password_hash, role: 'BACK_OFFICE' }
  });

  const analista = await prisma.user.create({
    data: { username: 'analista1', nombre: 'Pedro Analista', password_hash, role: 'ANALISTA' }
  });

  // 3. Cadena Lima Norte
  const jzNorte = await prisma.user.create({
    data: { username: 'jz_norte', nombre: 'Jefe Zonal Norte', password_hash, role: 'JEFE_ZONAL', supervisor_id: gerente.id, zone_id: zoneLimaNorte.id }
  });

  const supNorte = await prisma.user.create({
    data: { username: 'sup_norte', nombre: 'Supervisor Norte', password_hash, role: 'SUPERVISOR', supervisor_id: jzNorte.id, zone_id: zoneLimaNorte.id }
  });

  const vendNorte1 = await prisma.user.create({
    data: { username: 'vend_norte1', nombre: 'Vendedor N1', password_hash, role: 'VENDEDOR', supervisor_id: supNorte.id, zone_id: zoneLimaNorte.id }
  });

  const vendNorte2 = await prisma.user.create({
    data: { username: 'vend_norte2', nombre: 'Vendedor N2', password_hash, role: 'VENDEDOR', supervisor_id: supNorte.id, zone_id: zoneLimaNorte.id }
  });

  // 4. Cadena Lima Sur
  const jzSur = await prisma.user.create({
    data: { username: 'jz_sur', nombre: 'Jefe Zonal Sur', password_hash, role: 'JEFE_ZONAL', supervisor_id: gerente.id, zone_id: zoneLimaSur.id }
  });

  const supSur = await prisma.user.create({
    data: { username: 'sup_sur', nombre: 'Supervisor Sur', password_hash, role: 'SUPERVISOR', supervisor_id: jzSur.id, zone_id: zoneLimaSur.id }
  });

  const vendSur = await prisma.user.create({
    data: { username: 'vend_sur', nombre: 'Vendedor S1', password_hash, role: 'VENDEDOR', supervisor_id: supSur.id, zone_id: zoneLimaSur.id }
  });

  console.log('✅ Seed completado con éxito!');
  console.log('Configura SEED_ADMIN_PASSWORD para evitar credenciales por defecto.');
  console.log('Usuarios: admin, gerente1, jz_norte, sup_norte, vend_norte1, etc.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
