-- DropIndex
DROP INDEX "EmailAnnouncement_celebrityId_idx";

-- AlterTable
ALTER TABLE "Celebrity" ADD COLUMN     "chatAccountLabel" TEXT,
ADD COLUMN     "chatAccountType" TEXT NOT NULL DEFAULT 'TEAM',
ADD COLUMN     "chatLastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Fan" ADD COLUMN     "chatNotify" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "onboardingCelebritiesDone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FanCelebritySelection" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanCelebritySelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mutedByFan" BOOLEAN NOT NULL DEFAULT false,
    "pinnedByFan" BOOLEAN NOT NULL DEFAULT false,
    "lastMessagePreview" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageSender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "fanId" TEXT,
    "teamEmail" TEXT,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL DEFAULT '',
    "attachmentJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "repliedToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReadState" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fanLastReadAt" TIMESTAMP(3),
    "teamLastReadAt" TIMESTAMP(3),
    "fanDeliveredUpTo" TIMESTAMP(3),
    "teamDeliveredUpTo" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatBlock" (
    "id" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "reason" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "reporterFanId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FanCelebritySelection_fanId_idx" ON "FanCelebritySelection"("fanId");

-- CreateIndex
CREATE INDEX "FanCelebritySelection_celebrityId_idx" ON "FanCelebritySelection"("celebrityId");

-- CreateIndex
CREATE UNIQUE INDEX "FanCelebritySelection_fanId_celebrityId_key" ON "FanCelebritySelection"("fanId", "celebrityId");

-- CreateIndex
CREATE INDEX "ChatConversation_celebrityId_idx" ON "ChatConversation"("celebrityId");

-- CreateIndex
CREATE INDEX "ChatConversation_fanId_idx" ON "ChatConversation"("fanId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_fanId_celebrityId_key" ON "ChatConversation"("fanId", "celebrityId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_conversationId_clientId_key" ON "ChatMessage"("conversationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReadState_conversationId_key" ON "ChatReadState"("conversationId");

-- CreateIndex
CREATE INDEX "ChatBlock_fanId_idx" ON "ChatBlock"("fanId");

-- CreateIndex
CREATE INDEX "ChatBlock_celebrityId_idx" ON "ChatBlock"("celebrityId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatBlock_fanId_celebrityId_key" ON "ChatBlock"("fanId", "celebrityId");

-- CreateIndex
CREATE INDEX "MessageReport_status_idx" ON "MessageReport"("status");

-- CreateIndex
CREATE INDEX "MessageReport_conversationId_idx" ON "MessageReport"("conversationId");

-- CreateIndex
CREATE INDEX "MessageReport_reporterFanId_idx" ON "MessageReport"("reporterFanId");

-- AddForeignKey
ALTER TABLE "FanCelebritySelection" ADD CONSTRAINT "FanCelebritySelection_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanCelebritySelection" ADD CONSTRAINT "FanCelebritySelection_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_repliedToId_fkey" FOREIGN KEY ("repliedToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReadState" ADD CONSTRAINT "ChatReadState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reporterFanId_fkey" FOREIGN KEY ("reporterFanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
