-- AlterTable
ALTER TABLE "CelebrityEvent" ADD COLUMN     "maxRegistrations" INTEGER,
ADD COLUMN     "registrationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TicketOrder" ADD COLUMN     "ticketCode" TEXT;

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "ticketCode" TEXT NOT NULL,
    "ticketQrData" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_ticketCode_key" ON "EventRegistration"("ticketCode");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_email_idx" ON "EventRegistration"("email");

-- CreateIndex
CREATE INDEX "EventRegistration_ticketCode_idx" ON "EventRegistration"("ticketCode");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_email_idx" ON "EventRegistration"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "TicketOrder_ticketCode_key" ON "TicketOrder"("ticketCode");

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CelebrityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;