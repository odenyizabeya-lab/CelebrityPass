-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Celebrity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "profession" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "shortBio" TEXT,
    "googleOverview" TEXT,
    "googleInfo" TEXT,
    "profileImage" TEXT,
    "coverImage" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "socialLinks" TEXT,
    "cardDesign" TEXT,
    "website" TEXT,
    "instagramFollowers" INTEGER,
    "tiktokFollowers" INTEGER,
    "facebookFollowers" INTEGER,
    "followersUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Celebrity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipLevel" (
    "id" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "benefits" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MembershipLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanCard" (
    "id" TEXT NOT NULL,
    "fanNumber" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "membershipLevelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cardUrl" TEXT,
    "qrCode" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "cardId" TEXT,
    "celebrityId" TEXT,
    "membershipLevelId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "gatewayRef" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EventSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "baseUrl" TEXT,
    "configJson" TEXT,
    "envKey" TEXT,
    "hasCredentials" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "supportsTickets" BOOLEAN NOT NULL DEFAULT false,
    "ticketsLastSyncAt" TIMESTAMP(3),
    "ticketsLastSyncStatus" TEXT,
    "ticketsLastSyncMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSourceLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "rawJson" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CelebrityEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Public appearance',
    "description" TEXT,
    "venue" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "timezone" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "statusOverride" TEXT,
    "officialUrl" TEXT,
    "ticketUrl" TEXT,
    "sourceUrl" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CelebrityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventUpdate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "note" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketInventory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceId" TEXT,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "priceCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantityAvailable" INTEGER,
    "quantityTotal" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "url" TEXT,
    "displayAuthorized" BOOLEAN NOT NULL DEFAULT true,
    "saleStartAt" TIMESTAMP(3),
    "saleEndAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketOrder" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "fanId" TEXT,
    "eventId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerCountry" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "amountPaidCents" INTEGER,
    "paymentProvider" TEXT,
    "paymentRef" TEXT,
    "officialRef" TEXT,
    "deliveryMethod" TEXT,
    "deliveryDetail" TEXT,
    "notes" TEXT,
    "statusHistoryJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "eventId" TEXT NOT NULL,
    "ticketName" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "feesEachCents" INTEGER NOT NULL DEFAULT 0,
    "subtotalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "TicketOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PAYMENT',
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT,
    "providerRef" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CARD',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "credentialEnvKeysJson" TEXT,
    "hasCredentials" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT,
    "settlementAccountLabel" TEXT,
    "settlementAccountLast4" TEXT,
    "settlementAccountEnvKey" TEXT,
    "hasSettlementAccount" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "countryFlag" TEXT,
    "beneficiary" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountType" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "swift" TEXT,
    "routing" TEXT,
    "sortCode" TEXT,
    "institutionNumber" TEXT,
    "transitNumber" TEXT,
    "branchCode" TEXT,
    "bankCode" TEXT,
    "transferType" TEXT NOT NULL DEFAULT 'Local transfer',
    "bankAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "envKeyRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransferProof" (
    "id" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "bankAccountId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "senderName" TEXT,
    "reference" TEXT,
    "transferDate" TIMESTAMP(3),
    "fileName" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "adminNote" TEXT,
    "paymentId" TEXT,
    "ticketOrderId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransferProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRecord" (
    "id" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Celebrity_slug_key" ON "Celebrity"("slug");

-- CreateIndex
CREATE INDEX "Celebrity_category_idx" ON "Celebrity"("category");

-- CreateIndex
CREATE INDEX "Celebrity_country_idx" ON "Celebrity"("country");

-- CreateIndex
CREATE INDEX "Celebrity_isActive_idx" ON "Celebrity"("isActive");

-- CreateIndex
CREATE INDEX "MembershipLevel_celebrityId_idx" ON "MembershipLevel"("celebrityId");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_email_key" ON "Fan"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FanCard_fanNumber_key" ON "FanCard"("fanNumber");

-- CreateIndex
CREATE INDEX "FanCard_celebrityId_idx" ON "FanCard"("celebrityId");

-- CreateIndex
CREATE INDEX "FanCard_fanId_idx" ON "FanCard"("fanId");

-- CreateIndex
CREATE INDEX "FanCard_status_idx" ON "FanCard"("status");

-- CreateIndex
CREATE INDEX "Payment_fanId_idx" ON "Payment"("fanId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_cardId_idx" ON "Payment"("cardId");

-- CreateIndex
CREATE INDEX "Payment_celebrityId_idx" ON "Payment"("celebrityId");

-- CreateIndex
CREATE INDEX "Payment_membershipLevelId_idx" ON "Payment"("membershipLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSource_key_key" ON "EventSource"("key");

-- CreateIndex
CREATE INDEX "EventSourceLink_sourceId_idx" ON "EventSourceLink"("sourceId");

-- CreateIndex
CREATE INDEX "EventSourceLink_externalId_idx" ON "EventSourceLink"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSourceLink_eventId_sourceId_key" ON "EventSourceLink"("eventId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CelebrityEvent_eventId_key" ON "CelebrityEvent"("eventId");

-- CreateIndex
CREATE INDEX "CelebrityEvent_celebrityId_idx" ON "CelebrityEvent"("celebrityId");

-- CreateIndex
CREATE INDEX "CelebrityEvent_status_idx" ON "CelebrityEvent"("status");

-- CreateIndex
CREATE INDEX "CelebrityEvent_startAt_idx" ON "CelebrityEvent"("startAt");

-- CreateIndex
CREATE INDEX "CelebrityEvent_verification_idx" ON "CelebrityEvent"("verification");

-- CreateIndex
CREATE INDEX "EventUpdate_eventId_idx" ON "EventUpdate"("eventId");

-- CreateIndex
CREATE INDEX "TicketInventory_eventId_idx" ON "TicketInventory"("eventId");

-- CreateIndex
CREATE INDEX "TicketInventory_sourceId_idx" ON "TicketInventory"("sourceId");

-- CreateIndex
CREATE INDEX "TicketInventory_status_idx" ON "TicketInventory"("status");

-- CreateIndex
CREATE INDEX "TicketInventory_eventId_status_idx" ON "TicketInventory"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TicketOrder_orderRef_key" ON "TicketOrder"("orderRef");

-- CreateIndex
CREATE INDEX "TicketOrder_eventId_idx" ON "TicketOrder"("eventId");

-- CreateIndex
CREATE INDEX "TicketOrder_status_idx" ON "TicketOrder"("status");

-- CreateIndex
CREATE INDEX "TicketOrder_fanId_idx" ON "TicketOrder"("fanId");

-- CreateIndex
CREATE INDEX "TicketOrder_customerEmail_idx" ON "TicketOrder"("customerEmail");

-- CreateIndex
CREATE INDEX "TicketOrder_createdAt_idx" ON "TicketOrder"("createdAt");

-- CreateIndex
CREATE INDEX "TicketOrderItem_orderId_idx" ON "TicketOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "TicketOrderItem_inventoryId_idx" ON "TicketOrderItem"("inventoryId");

-- CreateIndex
CREATE INDEX "TicketTransaction_orderId_idx" ON "TicketTransaction"("orderId");

-- CreateIndex
CREATE INDEX "TicketTransaction_status_idx" ON "TicketTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_key_key" ON "PaymentMethod"("key");

-- CreateIndex
CREATE INDEX "PaymentMethod_isEnabled_idx" ON "PaymentMethod"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_currency_key" ON "BankAccount"("currency");

-- CreateIndex
CREATE INDEX "BankAccount_isActive_idx" ON "BankAccount"("isActive");

-- CreateIndex
CREATE INDEX "BankAccount_currency_idx" ON "BankAccount"("currency");

-- CreateIndex
CREATE INDEX "BankTransferProof_status_idx" ON "BankTransferProof"("status");

-- CreateIndex
CREATE INDEX "BankTransferProof_paymentId_idx" ON "BankTransferProof"("paymentId");

-- CreateIndex
CREATE INDEX "BankTransferProof_ticketOrderId_idx" ON "BankTransferProof"("ticketOrderId");

-- CreateIndex
CREATE INDEX "BankTransferProof_bankAccountId_idx" ON "BankTransferProof"("bankAccountId");

-- CreateIndex
CREATE INDEX "SettlementRecord_paymentMethodId_idx" ON "SettlementRecord"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "MembershipLevel" ADD CONSTRAINT "MembershipLevel_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanCard" ADD CONSTRAINT "FanCard_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanCard" ADD CONSTRAINT "FanCard_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanCard" ADD CONSTRAINT "FanCard_membershipLevelId_fkey" FOREIGN KEY ("membershipLevelId") REFERENCES "MembershipLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FanCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipLevelId_fkey" FOREIGN KEY ("membershipLevelId") REFERENCES "MembershipLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSourceLink" ADD CONSTRAINT "EventSourceLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CelebrityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSourceLink" ADD CONSTRAINT "EventSourceLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CelebrityEvent" ADD CONSTRAINT "CelebrityEvent_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventUpdate" ADD CONSTRAINT "EventUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CelebrityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketInventory" ADD CONSTRAINT "TicketInventory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CelebrityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketInventory" ADD CONSTRAINT "TicketInventory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CelebrityEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrderItem" ADD CONSTRAINT "TicketOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrderItem" ADD CONSTRAINT "TicketOrderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "TicketInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransaction" ADD CONSTRAINT "TicketTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferProof" ADD CONSTRAINT "BankTransferProof_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferProof" ADD CONSTRAINT "BankTransferProof_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferProof" ADD CONSTRAINT "BankTransferProof_ticketOrderId_fkey" FOREIGN KEY ("ticketOrderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRecord" ADD CONSTRAINT "SettlementRecord_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

