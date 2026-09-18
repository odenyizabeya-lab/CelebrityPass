-- Investor deposits paid via Bank Transfer / ATM with admin-verified receipt.
-- A BankTransferProof can now be linked to an investor deposit Transaction
-- (and optionally the InvestmentOpportunity it was paying toward), so one
-- proof row works for fan cards, tickets and investor deposits alike.

ALTER TABLE "BankTransferProof" ADD COLUMN "transactionId" TEXT;
ALTER TABLE "BankTransferProof" ADD COLUMN "opportunityId" TEXT;

ALTER TABLE "BankTransferProof"
ADD CONSTRAINT "BankTransferProof_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankTransferProof"
ADD CONSTRAINT "BankTransferProof_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BankTransferProof_transactionId_idx" ON "BankTransferProof"("transactionId");
CREATE INDEX "BankTransferProof_opportunityId_idx" ON "BankTransferProof"("opportunityId");