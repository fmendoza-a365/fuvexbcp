-- CreateTable
CREATE TABLE "SbiApiRequest" (
    "id" TEXT NOT NULL,
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
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SbiApiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SbiApiResult" (
    "id" TEXT NOT NULL,
    "sbi_api_request_id" TEXT NOT NULL,
    "external_id" TEXT,
    "payload" TEXT NOT NULL,
    "normalized_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SbiApiResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SbiApiRequest_user_id_idx" ON "SbiApiRequest"("user_id");
CREATE INDEX "SbiApiRequest_created_at_idx" ON "SbiApiRequest"("created_at");
CREATE INDEX "SbiApiRequest_success_idx" ON "SbiApiRequest"("success");

-- CreateIndex
CREATE INDEX "SbiApiResult_sbi_api_request_id_idx" ON "SbiApiResult"("sbi_api_request_id");

-- AddForeignKey
ALTER TABLE "SbiApiRequest" ADD CONSTRAINT "SbiApiRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SbiApiResult" ADD CONSTRAINT "SbiApiResult_sbi_api_request_id_fkey" FOREIGN KEY ("sbi_api_request_id") REFERENCES "SbiApiRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
