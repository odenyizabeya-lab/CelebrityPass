-- CreateTable
CREATE TABLE "BrokerageAccount" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "externalAccountId" TEXT,
    "buyingPowerCents" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerageAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'BUY',
    "orderType" TEXT NOT NULL DEFAULT 'MARKET',
    "quantityCents" BIGINT NOT NULL,
    "limitPriceCents" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT NOT NULL,
    "brokerRef" TEXT,
    "brokerStatus" TEXT,
    "rejectReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketExecution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantityCents" BIGINT NOT NULL,
    "priceCents" BIGINT NOT NULL,
    "feeCents" BIGINT NOT NULL DEFAULT 0,
    "brokerRef" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPosition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantityCents" BIGINT NOT NULL,
    "avgCostCents" BIGINT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTransaction" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'DEBIT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "symbol" TEXT,
    "amountCents" BIGINT NOT NULL DEFAULT 0,
    "quantityCents" BIGINT,
    "priceCents" BIGINT,
    "feeCents" BIGINT NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "brokerRef" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketQuoteCache" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "exchange" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceCents" BIGINT,
    "changeCents" BIGINT,
    "changePercent" INTEGER,
    "dayHighCents" BIGINT,
    "dayLowCents" BIGINT,
    "fiftyTwoWeekHighCents" BIGINT,
    "fiftyTwoWeekLowCents" BIGINT,
    "volume" BIGINT,
    "marketCapCents" BIGINT,
    "peRatio" DECIMAL(10,2),
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "fetchSource" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketQuoteCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageAccount_fanId_key" ON "BrokerageAccount"("fanId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageAccount_externalAccountId_key" ON "BrokerageAccount"("externalAccountId");

-- CreateIndex
CREATE INDEX "BrokerageAccount_status_idx" ON "BrokerageAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOrder_idempotencyKey_key" ON "MarketOrder"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOrder_brokerRef_key" ON "MarketOrder"("brokerRef");

-- CreateIndex
CREATE INDEX "MarketOrder_accountId_createdAt_idx" ON "MarketOrder"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketOrder_status_idx" ON "MarketOrder"("status");

-- CreateIndex
CREATE INDEX "MarketOrder_symbol_idx" ON "MarketOrder"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "MarketExecution_brokerRef_key" ON "MarketExecution"("brokerRef");

-- CreateIndex
CREATE INDEX "MarketExecution_accountId_executedAt_idx" ON "MarketExecution"("accountId", "executedAt");

-- CreateIndex
CREATE INDEX "MarketExecution_symbol_idx" ON "MarketExecution"("symbol");

-- CreateIndex
CREATE INDEX "MarketPosition_accountId_symbol_idx" ON "MarketPosition"("accountId", "symbol");

-- CreateIndex
CREATE INDEX "MarketPosition_isDemo_idx" ON "MarketPosition"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "MarketTransaction_ref_key" ON "MarketTransaction"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "MarketTransaction_brokerRef_key" ON "MarketTransaction"("brokerRef");

-- CreateIndex
CREATE INDEX "MarketTransaction_accountId_kind_idx" ON "MarketTransaction"("accountId", "kind");

-- CreateIndex
CREATE INDEX "MarketTransaction_accountId_createdAt_idx" ON "MarketTransaction"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketQuoteCache_symbol_key" ON "MarketQuoteCache"("symbol");

-- CreateIndex
CREATE INDEX "MarketQuoteCache_fetchedAt_idx" ON "MarketQuoteCache"("fetchedAt");

-- AddForeignKey
ALTER TABLE "BrokerageAccount" ADD CONSTRAINT "BrokerageAccount_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BrokerageAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketExecution" ADD CONSTRAINT "MarketExecution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketExecution" ADD CONSTRAINT "MarketExecution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BrokerageAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPosition" ADD CONSTRAINT "MarketPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BrokerageAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BrokerageAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

