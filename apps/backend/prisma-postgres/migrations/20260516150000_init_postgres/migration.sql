-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT,
    "distrito" TEXT,
    "ubigeo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "supervisor_id" TEXT,
    "zone_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "avatar_url" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "push_token" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoRequerido" (
    "id" TEXT NOT NULL,
    "convenio" TEXT NOT NULL,
    "tipo_doc" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoRequerido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
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
    "monto_solicitado" DOUBLE PRECISION,
    "plazo_deseado" INTEGER,
    "origen_prospecto" TEXT,
    "consentimiento" BOOLEAN NOT NULL DEFAULT false,
    "consentimiento_at" TIMESTAMP(3),
    "maf_neto" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROSPECTO_NUEVO',
    "fecha_filtro" TIMESTAMP(3),
    "fecha_ingreso" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fecha_desembolso" TIMESTAMP(3),
    "estado_remesa" TEXT,
    "carta_compra_deuda" TIMESTAMP(3),
    "monto_remesa" DOUBLE PRECISION,
    "vencimiento_remesa" TIMESTAMP(3),
    "feedback" TEXT,
    "rechazo_motivo" TEXT,
    "rechazo_detalle" TEXT,
    "calculadora_estado" TEXT,
    "simulacion_dictamen" TEXT,
    "simulacion_payload" TEXT,
    "simulacion_resultado" TEXT,
    "compra_deuda" BOOLEAN NOT NULL DEFAULT false,
    "compra_deuda_entidad" TEXT,
    "compra_deuda_monto" DOUBLE PRECISION,
    "compra_deuda_estado" TEXT,
    "fecha_liberacion" TIMESTAMP(3),
    "rcc_semaforo" TEXT,
    "rcc_monto_deuda" DOUBLE PRECISION,
    "rcc_ultima_act" TIMESTAMP(3),
    "rcc_calificacion" TEXT,
    "reasignacion_estado" TEXT,
    "reasignacion_de" TEXT,
    "reasignacion_motivo" TEXT,
    "reasignacion_por" TEXT,
    "reasignacion_fecha" TIMESTAMP(3),
    "asesor_id" TEXT NOT NULL,
    "fecha_estado_desde" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rcc_raw_data" TEXT,
    "simulacion_cuota" DOUBLE PRECISION,
    "simulacion_tea" DOUBLE PRECISION,
    "simulacion_plazo" INTEGER,
    "simulacion_monto" DOUBLE PRECISION,
    "simulacion_id" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "storage_key" TEXT,
    "estado_validacion" TEXT NOT NULL DEFAULT 'VIGENTE',
    "observacion" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT,
    "detalles" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackNote" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpedienteInstitucion" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "institucion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_envio" TIMESTAMP(3),
    "fecha_respuesta" TIMESTAMP(3),
    "observaciones" TEXT,
    "enviado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpedienteInstitucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpedienteBCP" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "nro_expediente" TEXT,
    "agencia" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_PREPARACION',
    "fecha_envio_bcp" TIMESTAMP(3),
    "fecha_respuesta" TIMESTAMP(3),
    "observaciones_bcp" TEXT,
    "checklist_json" TEXT,
    "creado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpedienteBCP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convenio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "periodo_gracia" INTEGER NOT NULL DEFAULT 0,
    "rci_default" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "variables_reserva" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sector" TEXT DEFAULT 'Otros',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convenio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvenioCargoRegla" (
    "id" TEXT NOT NULL,
    "convenio_id" TEXT NOT NULL,
    "cargo_id" TEXT NOT NULL,
    "rci_especifico" DOUBLE PRECISION NOT NULL,
    "edad_maxima" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConvenioCargoRegla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulacion" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dni_cliente" TEXT,
    "convenio" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "monto_solicitado" DOUBLE PRECISION NOT NULL,
    "cuotas" INTEGER NOT NULL,
    "tea" DOUBLE PRECISION NOT NULL,
    "cuota_mensual" DOUBLE PRECISION NOT NULL,
    "capacidad_max" DOUBLE PRECISION NOT NULL,
    "ingreso_neto" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionGlobal" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor_numerico" DOUBLE PRECISION,
    "valor_texto" TEXT,
    "descripcion" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionGlobal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_user_id_month_year_key" ON "Goal"("user_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoRequerido_convenio_tipo_doc_key" ON "DocumentoRequerido"("convenio", "tipo_doc");

-- CreateIndex
CREATE INDEX "Sale_asesor_id_idx" ON "Sale"("asesor_id");

-- CreateIndex
CREATE INDEX "Sale_estado_idx" ON "Sale"("estado");

-- CreateIndex
CREATE INDEX "Sale_created_at_idx" ON "Sale"("created_at");

-- CreateIndex
CREATE INDEX "Sale_updated_at_idx" ON "Sale"("updated_at");

-- CreateIndex
CREATE INDEX "Sale_dni_cliente_idx" ON "Sale"("dni_cliente");

-- CreateIndex
CREATE INDEX "Sale_fecha_ingreso_idx" ON "Sale"("fecha_ingreso");

-- CreateIndex
CREATE INDEX "Sale_fecha_desembolso_idx" ON "Sale"("fecha_desembolso");

-- CreateIndex
CREATE INDEX "Sale_departamento_provincia_distrito_idx" ON "Sale"("departamento", "provincia", "distrito");

-- CreateIndex
CREATE INDEX "Sale_reasignacion_estado_idx" ON "Sale"("reasignacion_estado");

-- CreateIndex
CREATE INDEX "Sale_estado_updated_at_idx" ON "Sale"("estado", "updated_at");

-- CreateIndex
CREATE INDEX "Document_sale_id_idx" ON "Document"("sale_id");

-- CreateIndex
CREATE INDEX "Document_uploaded_by_idx" ON "Document"("uploaded_by");

-- CreateIndex
CREATE INDEX "Document_created_at_idx" ON "Document"("created_at");

-- CreateIndex
CREATE INDEX "Document_tipo_documento_idx" ON "Document"("tipo_documento");

-- CreateIndex
CREATE INDEX "Document_estado_validacion_idx" ON "Document"("estado_validacion");

-- CreateIndex
CREATE INDEX "AuditLog_sale_id_idx" ON "AuditLog"("sale_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "AuditLog_estado_nuevo_idx" ON "AuditLog"("estado_nuevo");

-- CreateIndex
CREATE INDEX "FeedbackNote_sale_id_idx" ON "FeedbackNote"("sale_id");

-- CreateIndex
CREATE INDEX "FeedbackNote_user_id_idx" ON "FeedbackNote"("user_id");

-- CreateIndex
CREATE INDEX "FeedbackNote_created_at_idx" ON "FeedbackNote"("created_at");

-- CreateIndex
CREATE INDEX "ExpedienteInstitucion_sale_id_idx" ON "ExpedienteInstitucion"("sale_id");

-- CreateIndex
CREATE INDEX "ExpedienteInstitucion_estado_idx" ON "ExpedienteInstitucion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "ExpedienteBCP_sale_id_key" ON "ExpedienteBCP"("sale_id");

-- CreateIndex
CREATE INDEX "ExpedienteBCP_estado_idx" ON "ExpedienteBCP"("estado");

-- CreateIndex
CREATE INDEX "ExpedienteBCP_creado_por_idx" ON "ExpedienteBCP"("creado_por");

-- CreateIndex
CREATE UNIQUE INDEX "Convenio_nombre_key" ON "Convenio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nombre_key" ON "Cargo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ConvenioCargoRegla_convenio_id_cargo_id_key" ON "ConvenioCargoRegla"("convenio_id", "cargo_id");

-- CreateIndex
CREATE INDEX "Simulacion_user_id_idx" ON "Simulacion"("user_id");

-- CreateIndex
CREATE INDEX "Simulacion_dni_cliente_idx" ON "Simulacion"("dni_cliente");

-- CreateIndex
CREATE INDEX "Simulacion_created_at_idx" ON "Simulacion"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionGlobal_clave_key" ON "ConfiguracionGlobal"("clave");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackNote" ADD CONSTRAINT "FeedbackNote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackNote" ADD CONSTRAINT "FeedbackNote_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpedienteInstitucion" ADD CONSTRAINT "ExpedienteInstitucion_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpedienteInstitucion" ADD CONSTRAINT "ExpedienteInstitucion_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpedienteBCP" ADD CONSTRAINT "ExpedienteBCP_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpedienteBCP" ADD CONSTRAINT "ExpedienteBCP_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvenioCargoRegla" ADD CONSTRAINT "ConvenioCargoRegla_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "Convenio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvenioCargoRegla" ADD CONSTRAINT "ConvenioCargoRegla_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulacion" ADD CONSTRAINT "Simulacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

