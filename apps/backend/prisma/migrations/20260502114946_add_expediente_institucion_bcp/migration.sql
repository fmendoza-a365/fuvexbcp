-- CreateTable
CREATE TABLE "ExpedienteInstitucion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sale_id" TEXT NOT NULL,
    "institucion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_envio" DATETIME,
    "fecha_respuesta" DATETIME,
    "observaciones" TEXT,
    "enviado_por" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ExpedienteInstitucion_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpedienteInstitucion_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpedienteBCP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sale_id" TEXT NOT NULL,
    "nro_expediente" TEXT,
    "agencia" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_PREPARACION',
    "fecha_envio_bcp" DATETIME,
    "fecha_respuesta" DATETIME,
    "observaciones_bcp" TEXT,
    "checklist_json" TEXT,
    "creado_por" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ExpedienteBCP_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpedienteBCP_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExpedienteInstitucion_sale_id_idx" ON "ExpedienteInstitucion"("sale_id");

-- CreateIndex
CREATE INDEX "ExpedienteInstitucion_estado_idx" ON "ExpedienteInstitucion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "ExpedienteBCP_sale_id_key" ON "ExpedienteBCP"("sale_id");
