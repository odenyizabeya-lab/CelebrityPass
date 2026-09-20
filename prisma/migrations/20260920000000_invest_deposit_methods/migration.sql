-- AlterTable
-- Investor deposits now carry a method so the Bank Transfer and ATM deposit
-- queues can be kept permanently separate. Existing invest/card/ticket proofs
-- adopt the BANK_TRANSFER default (they are all bank-transfer proofs).
ALTER TABLE "BankTransferProof" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER';

-- CreateIndex
CREATE INDEX "BankTransferProof_method_idx" ON "BankTransferProof"("method");