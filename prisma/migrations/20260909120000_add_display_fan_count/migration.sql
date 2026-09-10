-- AlterTable
ALTER TABLE "Celebrity" ADD COLUMN     "displayFanCount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Celebrity_displayFanCount_key" ON "Celebrity"("displayFanCount");