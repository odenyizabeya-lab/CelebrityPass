-- AlterTable
ALTER TABLE "Celebrity" ADD COLUMN     "profileType" TEXT NOT NULL DEFAULT 'entertainment',
ADD COLUMN     "fansCardEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "InvestorProfile" (
    "id" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "overview" TEXT,
    "sector" TEXT,
    "ventures" TEXT,
    "opportunities" TEXT,
    "eligibility" TEXT,
    "risks" TEXT,
    "disclaimer" TEXT,
    "sourcesJson" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfile_celebrityId_key" ON "InvestorProfile"("celebrityId");

-- AddForeignKey
ALTER TABLE "InvestorProfile" ADD CONSTRAINT "InvestorProfile_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;