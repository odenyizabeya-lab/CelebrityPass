-- Email & Notifications system
-- ---------------------------------------------------------------
-- 1) Fan: email verification + notification preferences.
-- `notifyPromotions` is a marketing opt-in; the rest default to on so new
-- platform announcements reach fans unless they unsubscribe (one-click link
-- in the footer of every email).
ALTER TABLE "Fan" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fan" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Fan" ADD COLUMN "notifyNewCelebrities" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Fan" ADD COLUMN "notifyUpdates" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Fan" ADD COLUMN "notifyCommunity" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Fan" ADD COLUMN "notifyPromotions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Fan" ADD COLUMN "unsubscribedAt" TIMESTAMP(3);

-- 2) Email verification tokens (hashed at rest, one-time, expiring).
CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "fanId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_fanId_idx" ON "EmailVerificationToken"("fanId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- 3) Admin announcement campaigns.
CREATE TABLE "EmailAnnouncement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "audienceConfigJson" TEXT,
  "template" TEXT NOT NULL,
  "celebrityId" TEXT,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "targetsCount" INTEGER NOT NULL DEFAULT 0,
  "enqueuedCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailAnnouncement_status_idx" ON "EmailAnnouncement"("status");
CREATE INDEX "EmailAnnouncement_createdAt_idx" ON "EmailAnnouncement"("createdAt");
CREATE INDEX "EmailAnnouncement_celebrityId_idx" ON "EmailAnnouncement"("celebrityId");
ALTER TABLE "EmailAnnouncement" ADD CONSTRAINT "EmailAnnouncement_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) The persistent email queue. `dedupeKey` is unique per logical event so a
-- welcome/payment/announcement email can physically only ever be queued once.
CREATE TABLE "EmailMessage" (
  "id" TEXT NOT NULL,
  "fanId" TEXT,
  "announcementId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "from" TEXT,
  "subject" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailMessage_dedupeKey_key" ON "EmailMessage"("dedupeKey");
CREATE INDEX "EmailMessage_status_nextAttemptAt_idx" ON "EmailMessage"("status", "nextAttemptAt");
CREATE INDEX "EmailMessage_fanId_idx" ON "EmailMessage"("fanId");
CREATE INDEX "EmailMessage_announcementId_idx" ON "EmailMessage"("announcementId");
CREATE INDEX "EmailMessage_providerMessageId_idx" ON "EmailMessage"("providerMessageId");
CREATE INDEX "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "EmailAnnouncement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Webhook idempotency ledger. Provider event IDs are recorded exactly once;
-- a replayed/duplicated webhook is ignored instead of re-executed.
CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT,
  "payload" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledAt" TIMESTAMP(3),
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");