-- CreateTable
CREATE TABLE "PdfTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "convenio" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "original_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "storage_key" TEXT,
    "fields_json" TEXT NOT NULL DEFAULT '[]',
    "mappings_json" TEXT NOT NULL DEFAULT '{}',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "PdfTemplate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfTemplate_convenio_version_key" ON "PdfTemplate"("convenio", "version");

-- CreateIndex
CREATE INDEX "PdfTemplate_convenio_idx" ON "PdfTemplate"("convenio");

-- CreateIndex
CREATE INDEX "PdfTemplate_activo_idx" ON "PdfTemplate"("activo");

-- CreateIndex
CREATE INDEX "PdfTemplate_created_by_idx" ON "PdfTemplate"("created_by");
