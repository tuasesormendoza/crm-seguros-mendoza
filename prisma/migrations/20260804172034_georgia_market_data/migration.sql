-- CreateTable
CREATE TABLE "GeorgiaMarketData" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "ratingArea" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeorgiaMarketData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeorgiaMarketData_year_idx" ON "GeorgiaMarketData"("year");

-- CreateIndex
CREATE UNIQUE INDEX "GeorgiaMarketData_year_ratingArea_key" ON "GeorgiaMarketData"("year", "ratingArea");
