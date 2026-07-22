-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "images" TEXT,
    "daysBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_agencyId_idx" ON "Automation"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_agencyId_type_key" ON "Automation"("agencyId", "type");

-- CreateIndex
CREATE INDEX "Campaign_scheduledAt_idx" ON "Campaign"("scheduledAt");
