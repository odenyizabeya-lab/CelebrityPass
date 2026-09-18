-- CreateIndex
CREATE UNIQUE INDEX "MarketPosition_accountId_symbol_key" ON "MarketPosition"("accountId", "symbol");
