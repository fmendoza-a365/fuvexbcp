ALTER TABLE "Sale" ADD COLUMN "celular" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Sale" ADD COLUMN "telefono_alt" TEXT;
ALTER TABLE "Sale" ADD COLUMN "correo" TEXT;
ALTER TABLE "Sale" ADD COLUMN "direccion" TEXT;
ALTER TABLE "Sale" ADD COLUMN "provincia" TEXT;
ALTER TABLE "Sale" ADD COLUMN "distrito" TEXT;
ALTER TABLE "Sale" ADD COLUMN "zona_comercial" TEXT;
ALTER TABLE "Sale" ADD COLUMN "entidad_laboral" TEXT;
ALTER TABLE "Sale" ADD COLUMN "cargo_laboral" TEXT;
ALTER TABLE "Sale" ADD COLUMN "monto_solicitado" REAL;
ALTER TABLE "Sale" ADD COLUMN "plazo_deseado" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "origen_prospecto" TEXT;
ALTER TABLE "Sale" ADD COLUMN "consentimiento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sale" ADD COLUMN "consentimiento_at" DATETIME;

UPDATE "Sale"
SET
  "estado" = CASE
    WHEN "estado" = 'POR INGRESAR' THEN 'PROSPECTO_NUEVO'
    WHEN "estado" = 'EN PROCESO' THEN 'LISTO_SCORE'
    WHEN "estado" = 'APROBADA' THEN 'APROBADO_BCP'
    WHEN "estado" = 'OBSERVADA' THEN 'OBSERVADO'
    WHEN "estado" = 'SUBSANADA' THEN 'PENDIENTE_DOCUMENTOS'
    WHEN "estado" = 'PENDIENTE_DOCUMENTAR' THEN 'PENDIENTE_DOCUMENTOS'
    WHEN "estado" = 'PENDIENTE_INSTITUCIONES' THEN 'ENVIADO_CONVENIO'
    WHEN "estado" = 'PENDIENTE_BACK_OFFICE' THEN 'PREPARANDO_BCP'
    WHEN "estado" = 'EN_EVALUACION_BCP' THEN 'ENVIADO_BCP'
    WHEN "estado" = 'OBSERVADO_BACK' THEN 'OBSERVADO'
    WHEN "estado" = 'RECHAZADA_POR_SCORE' THEN 'RECHAZADO'
    WHEN "estado" = 'BOLETA_NO_CALIFICA' THEN 'RECHAZADO'
    WHEN "estado" = 'CONFORMIDAD' THEN 'APROBADO_BCP'
    ELSE "estado"
  END,
  "monto_solicitado" = COALESCE("monto_solicitado", "maf_neto"),
  "fecha_estado_desde" = COALESCE("fecha_estado_desde", "created_at");
