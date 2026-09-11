-- CreateTable
CREATE TABLE "ChatCall" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "fanId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'voice',
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "createdBy" TEXT NOT NULL DEFAULT 'fan',
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatCallSignal" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatCallSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatCall_conversationId_createdAt_idx" ON "ChatCall"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatCallSignal_callId_createdAt_idx" ON "ChatCallSignal"("callId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatCall" ADD CONSTRAINT "ChatCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCall" ADD CONSTRAINT "ChatCall_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCall" ADD CONSTRAINT "ChatCall_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCallSignal" ADD CONSTRAINT "ChatCallSignal_callId_fkey" FOREIGN KEY ("callId") REFERENCES "ChatCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;