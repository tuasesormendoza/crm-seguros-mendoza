-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "googleEventId" TEXT;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'crm';

-- CreateTable
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "syncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");

-- CreateIndex
CREATE INDEX "GoogleAccount_agencyId_idx" ON "GoogleAccount"("agencyId");
