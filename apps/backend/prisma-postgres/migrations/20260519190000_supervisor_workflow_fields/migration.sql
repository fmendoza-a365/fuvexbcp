-- Campos operativos para el flujo real de campo informado por supervisión.
ALTER TABLE "Sale" ADD COLUMN "estado_civil_cliente" TEXT;
ALTER TABLE "Sale" ADD COLUMN "conyuge_dni" TEXT;
ALTER TABLE "Sale" ADD COLUMN "conyuge_nombres" TEXT;
ALTER TABLE "Sale" ADD COLUMN "conyuge_rcc_semaforo" TEXT;
ALTER TABLE "Sale" ADD COLUMN "conyuge_rcc_monto_deuda" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "conyuge_rcc_ultima_act" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "conyuge_rcc_calificacion" TEXT;
ALTER TABLE "Sale" ADD COLUMN "conyuge_rcc_raw_data" TEXT;
ALTER TABLE "Sale" ADD COLUMN "score_bcp_estado" TEXT;
ALTER TABLE "Sale" ADD COLUMN "score_bcp_detalle" TEXT;
ALTER TABLE "Sale" ADD COLUMN "score_bcp_fecha" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "boleta_recibida_at" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "cotizacion_monto" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "cotizacion_cuota" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "cotizacion_plazo" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "cotizacion_enviada_at" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "cotizacion_aceptada_at" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "remesa_monto_original" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "remesa_monto_aprobado" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "remesa_reducida_aceptada" BOOLEAN;
ALTER TABLE "Sale" ADD COLUMN "carta_poder_recibida_at" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "carta_no_adeudo_at" TIMESTAMP(3);

UPDATE "Sale"
SET "estado" = CASE
  WHEN "estado" = 'PENDIENTE_ACEPTACION' THEN 'PENDIENTE_ACEPTACION_CLIENTE'
  WHEN "estado" = 'PENDIENTE_DOCUMENTAR' THEN 'PENDIENTE_DATOS_FILE'
  WHEN "estado" = 'PENDIENTE_BACK_OFFICE' THEN 'VALIDACION_BACK_OFFICE'
  WHEN "estado" = 'FILE_COMPLETO' THEN 'FILE_VALIDADO'
  WHEN "estado" = 'ENVIADO_CONVENIO' THEN 'FILE_VALIDADO'
  WHEN "estado" = 'OBS_CONVENIO' THEN 'OBS_BACK_OFFICE'
  WHEN "estado" = 'CONVENIO_APROBADO' THEN 'ENVIADO_BCP_REMESA'
  WHEN "estado" = 'EVALUACION_BCP' THEN 'ENVIADO_BCP_REMESA'
  WHEN "estado" = 'PENDIENTE_REMESA' THEN 'PENDIENTE_DESEMBOLSO'
  ELSE "estado"
END;
