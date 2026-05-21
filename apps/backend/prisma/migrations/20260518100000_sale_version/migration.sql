-- Control optimista para evitar que dos usuarios pisen cambios del mismo expediente.
ALTER TABLE "Sale" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
