-- Entrada pública de leads por agencia.
-- Desactivada por defecto: cada agencia la habilita cuando conecta su web.
ALTER TABLE "Agency" ADD COLUMN "publicIntakeKey" TEXT;
ALTER TABLE "Agency" ADD COLUMN "publicIntakeOrigins" TEXT;
ALTER TABLE "Agency" ADD COLUMN "publicIntakeEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Agency_publicIntakeKey_key" ON "Agency"("publicIntakeKey");
