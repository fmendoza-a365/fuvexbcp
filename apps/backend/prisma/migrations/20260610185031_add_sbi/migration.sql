-- CreateTable
CREATE TABLE "SbiApiRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "auth_mode" TEXT NOT NULL,
    "request_params" TEXT,
    "request_headers" TEXT,
    "status_code" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_id" INTEGER,
    "error_message" TEXT,
    "response_summary" TEXT,
    "duration_ms" INTEGER,
    "server_public_ip" TEXT,
    "executed_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "SbiApiRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SbiApiResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sbi_api_request_id" TEXT NOT NULL,
    "external_id" TEXT,
    "payload" TEXT NOT NULL,
    "normalized_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "SbiApiResult_sbi_api_request_id_fkey" FOREIGN KEY ("sbi_api_request_id") REFERENCES "SbiApiRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dni_cliente" TEXT NOT NULL,
    "nombres_cliente" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "telefono_alt" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "plaza" TEXT,
    "departamento" TEXT DEFAULT 'LIMA',
    "provincia" TEXT,
    "distrito" TEXT,
    "zona_comercial" TEXT,
    "convenio" TEXT,
    "entidad_laboral" TEXT,
    "cargo_laboral" TEXT,
    "monto_solicitado" REAL,
    "plazo_deseado" INTEGER,
    "origen_prospecto" TEXT,
    "consentimiento" BOOLEAN NOT NULL DEFAULT false,
    "consentimiento_at" DATETIME,
    "maf_neto" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROSPECTO_NUEVO',
    "fecha_filtro" DATETIME,
    "fecha_ingreso" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "fecha_desembolso" DATETIME,
    "estado_remesa" TEXT,
    "carta_compra_deuda" DATETIME,
    "monto_remesa" REAL,
    "vencimiento_remesa" DATETIME,
    "feedback" TEXT,
    "rechazo_motivo" TEXT,
    "rechazo_detalle" TEXT,
    "calculadora_estado" TEXT,
    "simulacion_dictamen" TEXT,
    "simulacion_payload" TEXT,
    "simulacion_resultado" TEXT,
    "compra_deuda" BOOLEAN NOT NULL DEFAULT false,
    "compra_deuda_entidad" TEXT,
    "compra_deuda_monto" REAL,
    "compra_deuda_estado" TEXT,
    "fecha_liberacion" DATETIME,
    "estado_civil_cliente" TEXT,
    "conyuge_dni" TEXT,
    "conyuge_nombres" TEXT,
    "conyuge_rcc_semaforo" TEXT,
    "conyuge_rcc_monto_deuda" REAL,
    "conyuge_rcc_ultima_act" DATETIME,
    "conyuge_rcc_calificacion" TEXT,
    "conyuge_rcc_raw_data" TEXT,
    "score_bcp_estado" TEXT,
    "score_bcp_detalle" TEXT,
    "score_bcp_fecha" DATETIME,
    "boleta_recibida_at" DATETIME,
    "cotizacion_monto" REAL,
    "cotizacion_cuota" REAL,
    "cotizacion_plazo" INTEGER,
    "cotizacion_enviada_at" DATETIME,
    "cotizacion_aceptada_at" DATETIME,
    "remesa_monto_original" REAL,
    "remesa_monto_aprobado" REAL,
    "remesa_reducida_aceptada" BOOLEAN,
    "carta_poder_recibida_at" DATETIME,
    "carta_no_adeudo_at" DATETIME,
    "rcc_semaforo" TEXT,
    "rcc_monto_deuda" REAL,
    "rcc_ultima_act" DATETIME,
    "rcc_calificacion" TEXT,
    "reasignacion_estado" TEXT,
    "reasignacion_de" TEXT,
    "reasignacion_motivo" TEXT,
    "reasignacion_por" TEXT,
    "reasignacion_fecha" DATETIME,
    "asesor_id" TEXT NOT NULL,
    "fecha_estado_desde" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rcc_raw_data" TEXT,
    "simulacion_cuota" REAL,
    "simulacion_tea" REAL,
    "simulacion_plazo" INTEGER,
    "simulacion_monto" REAL,
    "simulacion_id" TEXT,
    CONSTRAINT "Sale_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("asesor_id", "boleta_recibida_at", "calculadora_estado", "cargo_laboral", "carta_compra_deuda", "carta_no_adeudo_at", "carta_poder_recibida_at", "celular", "compra_deuda", "compra_deuda_entidad", "compra_deuda_estado", "compra_deuda_monto", "consentimiento", "consentimiento_at", "convenio", "conyuge_dni", "conyuge_nombres", "conyuge_rcc_calificacion", "conyuge_rcc_monto_deuda", "conyuge_rcc_raw_data", "conyuge_rcc_semaforo", "conyuge_rcc_ultima_act", "correo", "cotizacion_aceptada_at", "cotizacion_cuota", "cotizacion_enviada_at", "cotizacion_monto", "cotizacion_plazo", "created_at", "departamento", "direccion", "distrito", "dni_cliente", "entidad_laboral", "estado", "estado_civil_cliente", "estado_remesa", "fecha_desembolso", "fecha_estado_desde", "fecha_filtro", "fecha_ingreso", "fecha_liberacion", "feedback", "id", "maf_neto", "monto_remesa", "monto_solicitado", "nombres_cliente", "origen_prospecto", "plaza", "plazo_deseado", "provincia", "rcc_calificacion", "rcc_monto_deuda", "rcc_raw_data", "rcc_semaforo", "rcc_ultima_act", "reasignacion_de", "reasignacion_estado", "reasignacion_fecha", "reasignacion_motivo", "reasignacion_por", "rechazo_detalle", "rechazo_motivo", "remesa_monto_aprobado", "remesa_monto_original", "remesa_reducida_aceptada", "score_bcp_detalle", "score_bcp_estado", "score_bcp_fecha", "simulacion_cuota", "simulacion_dictamen", "simulacion_id", "simulacion_monto", "simulacion_payload", "simulacion_plazo", "simulacion_resultado", "simulacion_tea", "telefono_alt", "updated_at", "vencimiento_remesa", "version", "zona_comercial") SELECT "asesor_id", "boleta_recibida_at", "calculadora_estado", "cargo_laboral", "carta_compra_deuda", "carta_no_adeudo_at", "carta_poder_recibida_at", "celular", "compra_deuda", "compra_deuda_entidad", "compra_deuda_estado", "compra_deuda_monto", "consentimiento", "consentimiento_at", "convenio", "conyuge_dni", "conyuge_nombres", "conyuge_rcc_calificacion", "conyuge_rcc_monto_deuda", "conyuge_rcc_raw_data", "conyuge_rcc_semaforo", "conyuge_rcc_ultima_act", "correo", "cotizacion_aceptada_at", "cotizacion_cuota", "cotizacion_enviada_at", "cotizacion_monto", "cotizacion_plazo", "created_at", "departamento", "direccion", "distrito", "dni_cliente", "entidad_laboral", "estado", "estado_civil_cliente", "estado_remesa", "fecha_desembolso", "fecha_estado_desde", "fecha_filtro", "fecha_ingreso", "fecha_liberacion", "feedback", "id", "maf_neto", "monto_remesa", "monto_solicitado", "nombres_cliente", "origen_prospecto", "plaza", "plazo_deseado", "provincia", "rcc_calificacion", "rcc_monto_deuda", "rcc_raw_data", "rcc_semaforo", "rcc_ultima_act", "reasignacion_de", "reasignacion_estado", "reasignacion_fecha", "reasignacion_motivo", "reasignacion_por", "rechazo_detalle", "rechazo_motivo", "remesa_monto_aprobado", "remesa_monto_original", "remesa_reducida_aceptada", "score_bcp_detalle", "score_bcp_estado", "score_bcp_fecha", "simulacion_cuota", "simulacion_dictamen", "simulacion_id", "simulacion_monto", "simulacion_payload", "simulacion_plazo", "simulacion_resultado", "simulacion_tea", "telefono_alt", "updated_at", "vencimiento_remesa", "version", "zona_comercial" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SbiApiRequest_user_id_idx" ON "SbiApiRequest"("user_id");

-- CreateIndex
CREATE INDEX "SbiApiRequest_created_at_idx" ON "SbiApiRequest"("created_at");

-- CreateIndex
CREATE INDEX "SbiApiRequest_success_idx" ON "SbiApiRequest"("success");

-- CreateIndex
CREATE INDEX "SbiApiResult_sbi_api_request_id_idx" ON "SbiApiResult"("sbi_api_request_id");
