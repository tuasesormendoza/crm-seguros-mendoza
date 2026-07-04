-- CreateTable
CREATE TABLE "GoogleEventLink" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "googleAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleEventLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleEventLink_agencyId_idx" ON "GoogleEventLink"("agencyId");

-- CreateIndex
CREATE INDEX "GoogleEventLink_crmId_idx" ON "GoogleEventLink"("crmId");

-- CreateIndex
CREATE INDEX "GoogleEventLink_googleEventId_idx" ON "GoogleEventLink"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleEventLink_googleAccountId_kind_crmId_key" ON "GoogleEventLink"("googleAccountId", "kind", "crmId");
