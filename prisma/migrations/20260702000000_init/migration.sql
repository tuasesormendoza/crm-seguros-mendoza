-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "contractDate" TIMESTAMP(3),
    "policyYear" INTEGER,
    "fullName" TEXT NOT NULL,
    "ssn" TEXT,
    "birthDate" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,
    "filesTaxes" BOOLEAN,
    "filingStatus" TEXT,
    "maritalStatus" TEXT,
    "employmentType" TEXT,
    "address" TEXT,
    "aptSuite" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "county" TEXT,
    "state" TEXT,
    "coverageType" TEXT,
    "insurer" TEXT,
    "affiliatesCount" INTEGER DEFAULT 1,
    "planName" TEXT,
    "planCategory" TEXT,
    "planId" TEXT,
    "planNetwork" TEXT,
    "planDeductible" TEXT,
    "planMaxOOP" TEXT,
    "planPCP" TEXT,
    "planSpecialist" TEXT,
    "planUrgentCare" TEXT,
    "planHospital" TEXT,
    "planRxGeneric" TEXT,
    "planXray" TEXT,
    "planCTScan" TEXT,
    "planLab" TEXT,
    "planReferral" TEXT,
    "acaPrice" DOUBLE PRECISION DEFAULT 0,
    "aptcAmount" DOUBLE PRECISION,
    "wnPolicies" TEXT,
    "wnContractDate" TIMESTAMP(3),
    "cancellationDate" TIMESTAMP(3),
    "wnSecondPaymentReceived" BOOLEAN DEFAULT false,
    "wnClawbackReturned" BOOLEAN DEFAULT false,
    "totalMonthly" DOUBLE PRECISION DEFAULT 0,
    "annualIncome" DOUBLE PRECISION,
    "status" TEXT DEFAULT 'Activo',
    "activationDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "policyExpirationDate" TIMESTAMP(3),
    "preferredDoctors" TEXT,
    "specificMedications" TEXT,
    "bankHolder" TEXT,
    "bankName" TEXT,
    "bankRouting" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" TEXT,
    "portalUser" TEXT,
    "portalPassword" TEXT,
    "sherpaUrl" TEXT,
    "googleReview" TEXT,
    "referralRequestStage" TEXT,
    "referralRequestSentAt" TIMESTAMP(3),
    "referralRequestLastSent" TIMESTAMP(3),
    "notes" TEXT,
    "preferredLanguage" TEXT,
    "dentalInsurer" TEXT,
    "dentalDeductible" TEXT,
    "dentalMaxBenefit" TEXT,
    "dentalMonthly" DOUBLE PRECISION DEFAULT 0,
    "firstPaymentPaid" BOOLEAN DEFAULT false,
    "firstPaymentDate" TIMESTAMP(3),
    "tags" TEXT,
    "applicantInPolicy" BOOLEAN DEFAULT true,
    "applicantExclusionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurerHistory" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsurerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyHistory" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "insurer" TEXT,
    "planName" TEXT,
    "planCategory" TEXT,
    "acaPrice" DOUBLE PRECISION,
    "totalMonthly" DOUBLE PRECISION,
    "wnPolicies" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "birthDate" TIMESTAMP(3),
    "ssn" TEXT,
    "inPolicy" BOOLEAN,
    "coverageNote" TEXT,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Programada',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "insurer" TEXT NOT NULL,
    "pmpm" DOUBLE PRECISION NOT NULL,
    "paymentDay" INTEGER,
    "monthsToFirstPayment" INTEGER DEFAULT 2,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "insurer" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "items" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionCheck" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "gapReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Otro',
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "state" TEXT,
    "source" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Nuevo Lead (Por Contactar)',
    "notes" TEXT,
    "referredByClientId" TEXT,
    "referredByName" TEXT,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zipCode" TEXT,
    "income" TEXT,
    "householdSize" TEXT,
    "sherpaStatus" TEXT,
    "consentAt" TIMESTAMP(3),
    "callbackAt" TIMESTAMP(3),
    "lossReason" TEXT,
    "tags" TEXT,
    "followUpAt" TIMESTAMP(3),
    "followUpNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agencyId" TEXT,
    "ratingAtention" INTEGER,
    "ratingClarity" INTEGER,
    "ratingSpeed" INTEGER,
    "ratingDedication" INTEGER,
    "recommends" TEXT,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_agencyId_idx" ON "Client"("agencyId");

-- CreateIndex
CREATE INDEX "Client_agencyId_fullName_idx" ON "Client"("agencyId", "fullName");

-- CreateIndex
CREATE INDEX "Client_agencyId_status_idx" ON "Client"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Client_agencyId_renewalDate_idx" ON "Client"("agencyId", "renewalDate");

-- CreateIndex
CREATE INDEX "InsurerHistory_clientId_idx" ON "InsurerHistory"("clientId");

-- CreateIndex
CREATE INDEX "InsurerHistory_agencyId_idx" ON "InsurerHistory"("agencyId");

-- CreateIndex
CREATE INDEX "PolicyHistory_agencyId_idx" ON "PolicyHistory"("agencyId");

-- CreateIndex
CREATE INDEX "Dependent_agencyId_idx" ON "Dependent"("agencyId");

-- CreateIndex
CREATE INDEX "Appointment_agencyId_idx" ON "Appointment"("agencyId");

-- CreateIndex
CREATE INDEX "Activity_agencyId_idx" ON "Activity"("agencyId");

-- CreateIndex
CREATE INDEX "CommissionRate_agencyId_idx" ON "CommissionRate"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRate_agencyId_insurer_key" ON "CommissionRate"("agencyId", "insurer");

-- CreateIndex
CREATE INDEX "CommissionPayment_insurer_period_idx" ON "CommissionPayment"("insurer", "period");

-- CreateIndex
CREATE INDEX "CommissionPayment_agencyId_idx" ON "CommissionPayment"("agencyId");

-- CreateIndex
CREATE INDEX "CommissionCheck_period_idx" ON "CommissionCheck"("period");

-- CreateIndex
CREATE INDEX "CommissionCheck_agencyId_idx" ON "CommissionCheck"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCheck_clientId_period_key" ON "CommissionCheck"("clientId", "period");

-- CreateIndex
CREATE INDEX "CalendarEvent_agencyId_idx" ON "CalendarEvent"("agencyId");

-- CreateIndex
CREATE INDEX "Document_agencyId_idx" ON "Document"("agencyId");

-- CreateIndex
CREATE INDEX "Settings_agencyId_idx" ON "Settings"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_agencyId_key_key" ON "Settings"("agencyId", "key");

-- CreateIndex
CREATE INDEX "NotificationLog_agencyId_idx" ON "NotificationLog"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_agencyId_type_refId_key" ON "NotificationLog"("agencyId", "type", "refId");

-- CreateIndex
CREATE INDEX "Prospect_agencyId_idx" ON "Prospect"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_clientId_idx" ON "SurveyResponse"("clientId");

-- CreateIndex
CREATE INDEX "SurveyResponse_agencyId_idx" ON "SurveyResponse"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_identifier_key" ON "LoginAttempt"("identifier");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_entity_entityId_idx" ON "AuditLog"("agencyId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "InsurerHistory" ADD CONSTRAINT "InsurerHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyHistory" ADD CONSTRAINT "PolicyHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCheck" ADD CONSTRAINT "CommissionCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
