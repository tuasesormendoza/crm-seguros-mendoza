-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "doctorName" TEXT,
ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "wnPaymentDay" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_agencyId_idx" ON "Contact"("agencyId");

-- CreateIndex
CREATE INDEX "Contact_agencyId_name_idx" ON "Contact"("agencyId", "name");
