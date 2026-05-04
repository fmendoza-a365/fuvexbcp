-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "simulacion_cuota" REAL;
ALTER TABLE "Sale" ADD COLUMN "simulacion_id" TEXT;
ALTER TABLE "Sale" ADD COLUMN "simulacion_monto" REAL;
ALTER TABLE "Sale" ADD COLUMN "simulacion_plazo" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "simulacion_tea" REAL;

-- CreateTable
CREATE TABLE "DocumentoRequerido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "convenio" TEXT NOT NULL,
    "tipo_doc" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoRequerido_convenio_tipo_doc_key" ON "DocumentoRequerido"("convenio", "tipo_doc");
