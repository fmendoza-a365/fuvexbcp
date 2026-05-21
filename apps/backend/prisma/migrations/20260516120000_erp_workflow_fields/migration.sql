ALTER TABLE "Sale" ADD COLUMN "rechazo_motivo" TEXT;
ALTER TABLE "Sale" ADD COLUMN "rechazo_detalle" TEXT;
ALTER TABLE "Sale" ADD COLUMN "calculadora_estado" TEXT;
ALTER TABLE "Sale" ADD COLUMN "simulacion_dictamen" TEXT;
ALTER TABLE "Sale" ADD COLUMN "simulacion_payload" TEXT;
ALTER TABLE "Sale" ADD COLUMN "simulacion_resultado" TEXT;
ALTER TABLE "Sale" ADD COLUMN "compra_deuda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sale" ADD COLUMN "compra_deuda_entidad" TEXT;
ALTER TABLE "Sale" ADD COLUMN "compra_deuda_monto" REAL;
ALTER TABLE "Sale" ADD COLUMN "compra_deuda_estado" TEXT;
ALTER TABLE "Sale" ADD COLUMN "fecha_liberacion" DATETIME;

UPDATE "Sale"
SET
  "estado" = CASE
    WHEN "estado" = 'PENDIENTE_DATOS' THEN 'PROSPECTO_NUEVO'
    WHEN "estado" = 'PENDIENTE_DOCUMENTOS' THEN 'PENDIENTE_DOCUMENTAR'
    WHEN "estado" = 'LISTO_SCORE' THEN 'PENDIENTE_BACK_OFFICE'
    WHEN "estado" = 'SCORE_APROBADO' THEN 'PENDIENTE_ACEPTACION'
    WHEN "estado" = 'SIMULACION_ACEPTADA' THEN 'PENDIENTE_DOCUMENTAR'
    WHEN "estado" = 'PREPARANDO_BCP' THEN 'CONVENIO_APROBADO'
    WHEN "estado" = 'ENVIADO_BCP' THEN 'EVALUACION_BCP'
    WHEN "estado" = 'APROBADO_BCP' THEN 'PENDIENTE_REMESA'
    WHEN "estado" = 'OBSERVADO' THEN 'OBS_BACK_OFFICE'
    WHEN "estado" = 'OBSERVADO_BACK' THEN 'OBS_BACK_OFFICE'
    WHEN "estado" = 'EN_EVALUACION_BCP' THEN 'EVALUACION_BCP'
    WHEN "estado" = 'PENDIENTE_DOCUMENTOS' THEN 'PENDIENTE_DOCUMENTAR'
    ELSE "estado"
  END,
  "fecha_estado_desde" = COALESCE("fecha_estado_desde", "created_at");
