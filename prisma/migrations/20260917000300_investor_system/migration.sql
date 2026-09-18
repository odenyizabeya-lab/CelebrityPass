-- Generated from Prisma schema (prisma migrate diff --from-empty).
-- Repaired 2026-09-18: the prior draft contained only CREATE TABLE + primary keys;
-- this file adds the missing unique indexes, foreign keys and secondary indexes
-- required by schema.prisma.
CREATE TABLE "InvestorAccount" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "investorNumber" TEXT NOT NULL,
    "legalFullName" TEXT,
    "country" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "riskFlag" TEXT,
    "riskFlagReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pwdChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycRecord" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "legalFullName" TEXT,
    "dateOfBirth" TEXT,
    "country" TEXT,
    "documentType" TEXT,
    "documentRef" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestmentOpportunity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "investmentType" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "minAmount" DECIMAL(20,2),
    "maxAmount" DECIMAL(20,2),
    "targetAmount" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "feesJson" TEXT,
    "investmentPeriodJson" TEXT,
    "liquidityText" TEXT,
    "risksText" TEXT,
    "expectedReturnText" TEXT,
    "eligibilityJson" TEXT,
    "disclosuresJson" TEXT,
    "legalTermsText" TEXT,
    "linkedCelebrityId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestmentPosition" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "valuationStatus" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "currentValue" DECIMAL(20,2),
    "valuationSource" TEXT,
    "valuationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestmentOrder" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "eligibilityChecksJson" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'demo',
    "providerRef" TEXT,
    "gatewayEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "txnRef" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "orderId" TEXT,
    "positionId" TEXT,
    "withdrawalId" TEXT,
    "provider" TEXT,
    "providerRef" TEXT,
    "gatewayEventId" TEXT,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "txnId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "destinationJson" TEXT,
    "reviewNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "reference" TEXT,
    "previousBalance" DECIMAL(20,2),
    "newBalance" DECIMAL(20,2),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisclosureAcceptance" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "documentKey" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentTitle" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "DisclosureAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestmentDocument" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT,
    "investorId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "storageRef" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detailsJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceAlert" (
    "id" TEXT NOT NULL,
    "investorId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'LOW',
    "ruleKey" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestNotification" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestorAccount_fanId_key" ON "InvestorAccount"("fanId");

CREATE UNIQUE INDEX "InvestorAccount_investorNumber_key" ON "InvestorAccount"("investorNumber");

CREATE INDEX "InvestorAccount_accountStatus_idx" ON "InvestorAccount"("accountStatus");

CREATE INDEX "InvestorAccount_kycStatus_idx" ON "InvestorAccount"("kycStatus");

CREATE UNIQUE INDEX "KycRecord_investorId_key" ON "KycRecord"("investorId");

CREATE UNIQUE INDEX "InvestmentOpportunity_slug_key" ON "InvestmentOpportunity"("slug");

CREATE INDEX "InvestmentOpportunity_status_idx" ON "InvestmentOpportunity"("status");

CREATE INDEX "InvestmentOpportunity_investmentType_idx" ON "InvestmentOpportunity"("investmentType");

CREATE INDEX "InvestmentOpportunity_linkedCelebrityId_idx" ON "InvestmentOpportunity"("linkedCelebrityId");

CREATE INDEX "InvestmentPosition_investorId_idx" ON "InvestmentPosition"("investorId");

CREATE INDEX "InvestmentPosition_opportunityId_status_idx" ON "InvestmentPosition"("opportunityId", "status");

CREATE UNIQUE INDEX "InvestmentOrder_providerRef_key" ON "InvestmentOrder"("providerRef");

CREATE UNIQUE INDEX "InvestmentOrder_gatewayEventId_key" ON "InvestmentOrder"("gatewayEventId");

CREATE INDEX "InvestmentOrder_investorId_idx" ON "InvestmentOrder"("investorId");

CREATE INDEX "InvestmentOrder_opportunityId_status_idx" ON "InvestmentOrder"("opportunityId", "status");

CREATE INDEX "InvestmentOrder_status_idx" ON "InvestmentOrder"("status");

CREATE UNIQUE INDEX "Transaction_txnRef_key" ON "Transaction"("txnRef");

CREATE UNIQUE INDEX "Transaction_withdrawalId_key" ON "Transaction"("withdrawalId");

CREATE UNIQUE INDEX "Transaction_providerRef_key" ON "Transaction"("providerRef");

CREATE UNIQUE INDEX "Transaction_gatewayEventId_key" ON "Transaction"("gatewayEventId");

CREATE INDEX "Transaction_investorId_kind_idx" ON "Transaction"("investorId", "kind");

CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");

CREATE INDEX "Transaction_positionId_idx" ON "Transaction"("positionId");

CREATE INDEX "Transaction_withdrawalId_idx" ON "Transaction"("withdrawalId");

CREATE INDEX "LedgerEntry_account_idx" ON "LedgerEntry"("account");

CREATE INDEX "LedgerEntry_txnId_idx" ON "LedgerEntry"("txnId");

CREATE UNIQUE INDEX "Withdrawal_ref_key" ON "Withdrawal"("ref");

CREATE INDEX "Withdrawal_investorId_status_idx" ON "Withdrawal"("investorId", "status");

CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

CREATE UNIQUE INDEX "Adjustment_ref_key" ON "Adjustment"("ref");

CREATE INDEX "Adjustment_investorId_status_idx" ON "Adjustment"("investorId", "status");

CREATE INDEX "DisclosureAcceptance_investorId_idx" ON "DisclosureAcceptance"("investorId");

CREATE UNIQUE INDEX "DisclosureAcceptance_investorId_opportunityId_documentKey_d_key" ON "DisclosureAcceptance"("investorId", "opportunityId", "documentKey", "documentVersion");

CREATE INDEX "InvestmentDocument_opportunityId_idx" ON "InvestmentDocument"("opportunityId");

CREATE INDEX "InvestmentDocument_investorId_idx" ON "InvestmentDocument"("investorId");

CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

CREATE INDEX "ComplianceAlert_status_idx" ON "ComplianceAlert"("status");

CREATE INDEX "ComplianceAlert_investorId_idx" ON "ComplianceAlert"("investorId");

CREATE INDEX "InvestNotification_investorId_idx" ON "InvestNotification"("investorId");

CREATE INDEX "InvestNotification_type_idx" ON "InvestNotification"("type");

ALTER TABLE "InvestorAccount" ADD CONSTRAINT "InvestorAccount_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KycRecord" ADD CONSTRAINT "KycRecord_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentOpportunity" ADD CONSTRAINT "InvestmentOpportunity_linkedCelebrityId_fkey" FOREIGN KEY ("linkedCelebrityId") REFERENCES "Celebrity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentOrder" ADD CONSTRAINT "InvestmentOrder_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentOrder" ADD CONSTRAINT "InvestmentOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "InvestmentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_txnId_fkey" FOREIGN KEY ("txnId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisclosureAcceptance" ADD CONSTRAINT "DisclosureAcceptance_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisclosureAcceptance" ADD CONSTRAINT "DisclosureAcceptance_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvestmentDocument" ADD CONSTRAINT "InvestmentDocument_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentDocument" ADD CONSTRAINT "InvestmentDocument_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestNotification" ADD CONSTRAINT "InvestNotification_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
