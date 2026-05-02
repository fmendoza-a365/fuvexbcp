const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showMatrix() {
  const reglas = await prisma.convenioCargoRegla.findMany({
    include: {
      convenio: true,
      cargo: true
    }
  });

  const matrix = {};
  reglas.forEach(r => {
    if (!matrix[r.convenio.nombre]) {
      matrix[r.convenio.nombre] = [];
    }
    matrix[r.convenio.nombre].push({
      cargo: r.cargo.nombre,
      rci: (r.rci_especifico * 100) + '%',
      edad_max: r.edad_maxima || 'No def'
    });
  });

  console.log(JSON.stringify(matrix, null, 2));
}

showMatrix()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
