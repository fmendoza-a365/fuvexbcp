ALTER TABLE "Document" ADD COLUMN "original_name" TEXT;
ALTER TABLE "Document" ADD COLUMN "mime_type" TEXT;
ALTER TABLE "Document" ADD COLUMN "size_bytes" INTEGER;
ALTER TABLE "Document" ADD COLUMN "checksum_sha256" TEXT;
ALTER TABLE "Document" ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "Document" ADD COLUMN "storage_key" TEXT;
ALTER TABLE "Document" ADD COLUMN "estado_validacion" TEXT NOT NULL DEFAULT 'VIGENTE';
ALTER TABLE "Document" ADD COLUMN "observacion" TEXT;

CREATE INDEX "Sale_asesor_id_idx" ON "Sale"("asesor_id");
CREATE INDEX "Sale_estado_idx" ON "Sale"("estado");
CREATE INDEX "Sale_created_at_idx" ON "Sale"("created_at");
CREATE INDEX "Sale_updated_at_idx" ON "Sale"("updated_at");
CREATE INDEX "Sale_dni_cliente_idx" ON "Sale"("dni_cliente");
CREATE INDEX "Sale_fecha_ingreso_idx" ON "Sale"("fecha_ingreso");
CREATE INDEX "Sale_fecha_desembolso_idx" ON "Sale"("fecha_desembolso");
CREATE INDEX "Sale_departamento_provincia_distrito_idx" ON "Sale"("departamento", "provincia", "distrito");
CREATE INDEX "Sale_reasignacion_estado_idx" ON "Sale"("reasignacion_estado");
CREATE INDEX "Sale_estado_updated_at_idx" ON "Sale"("estado", "updated_at");

CREATE INDEX "Document_sale_id_idx" ON "Document"("sale_id");
CREATE INDEX "Document_uploaded_by_idx" ON "Document"("uploaded_by");
CREATE INDEX "Document_created_at_idx" ON "Document"("created_at");
CREATE INDEX "Document_tipo_documento_idx" ON "Document"("tipo_documento");
CREATE INDEX "Document_estado_validacion_idx" ON "Document"("estado_validacion");

CREATE INDEX "AuditLog_sale_id_idx" ON "AuditLog"("sale_id");
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");
CREATE INDEX "AuditLog_estado_nuevo_idx" ON "AuditLog"("estado_nuevo");

CREATE INDEX "FeedbackNote_sale_id_idx" ON "FeedbackNote"("sale_id");
CREATE INDEX "FeedbackNote_user_id_idx" ON "FeedbackNote"("user_id");
CREATE INDEX "FeedbackNote_created_at_idx" ON "FeedbackNote"("created_at");

CREATE INDEX "ExpedienteBCP_estado_idx" ON "ExpedienteBCP"("estado");
CREATE INDEX "ExpedienteBCP_creado_por_idx" ON "ExpedienteBCP"("creado_por");

CREATE INDEX "Simulacion_user_id_idx" ON "Simulacion"("user_id");
CREATE INDEX "Simulacion_dni_cliente_idx" ON "Simulacion"("dni_cliente");
CREATE INDEX "Simulacion_created_at_idx" ON "Simulacion"("created_at");
