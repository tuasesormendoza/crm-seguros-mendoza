-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "CalendarEvent_clientId_idx" ON "CalendarEvent"("clientId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
