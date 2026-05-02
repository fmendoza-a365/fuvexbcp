-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "distrito" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "supervisor_id" TEXT,
    "zone_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "avatar_url" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "push_token" TEXT,
    CONSTRAINT "User_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Goal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dni_cliente" TEXT NOT NULL,
    "nombres_cliente" TEXT NOT NULL,
    "plaza" TEXT,
    "departamento" TEXT DEFAULT 'LIMA',
    "convenio" TEXT,
    "maf_neto" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'POR INGRESAR',
    "fecha_filtro" DATETIME,
    "fecha_ingreso" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "fecha_desembolso" DATETIME,
    "estado_remesa" TEXT,
    "carta_compra_deuda" DATETIME,
    "monto_remesa" REAL,
    "vencimiento_remesa" DATETIME,
    "feedback" TEXT,
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "rcc_raw_data" TEXT,
    CONSTRAINT "Sale_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sale_id" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sale_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT,
    "detalles" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sale_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackNote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeedbackNote_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Convenio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "periodo_gracia" INTEGER NOT NULL DEFAULT 0,
    "rci_default" REAL NOT NULL DEFAULT 0.3,
    "variables_reserva" REAL NOT NULL DEFAULT 0.0,
    "sector" TEXT DEFAULT 'Otros',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConvenioCargoRegla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "convenio_id" TEXT NOT NULL,
    "cargo_id" TEXT NOT NULL,
    "rci_especifico" REAL NOT NULL,
    "edad_maxima" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ConvenioCargoRegla_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "Convenio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConvenioCargoRegla_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "Cargo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Simulacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "dni_cliente" TEXT,
    "convenio" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "monto_solicitado" REAL NOT NULL,
    "cuotas" INTEGER NOT NULL,
    "tea" REAL NOT NULL,
    "cuota_mensual" REAL NOT NULL,
    "capacidad_max" REAL NOT NULL,
    "ingreso_neto" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Simulacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfiguracionGlobal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clave" TEXT NOT NULL,
    "valor_numerico" REAL,
    "valor_texto" TEXT,
    "descripcion" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_user_id_month_year_key" ON "Goal"("user_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Convenio_nombre_key" ON "Convenio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nombre_key" ON "Cargo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ConvenioCargoRegla_convenio_id_cargo_id_key" ON "ConvenioCargoRegla"("convenio_id", "cargo_id");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionGlobal_clave_key" ON "ConfiguracionGlobal"("clave");
