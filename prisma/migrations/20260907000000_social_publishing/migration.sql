-- AlterTable
ALTER TABLE "Celebrity" ADD COLUMN     "socialAutoPost" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CelebrityEvent" ADD COLUMN     "socialAutoPost" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "MembershipLevel" ADD COLUMN     "socialAutoPost" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SocialPlatform" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "icon" TEXT,
    "supportsText" BOOLEAN NOT NULL DEFAULT true,
    "supportsImage" BOOLEAN NOT NULL DEFAULT true,
    "supportsVideo" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'not_required',
    "approvalNote" TEXT,
    "authUrl" TEXT,
    "tokenUrl" TEXT,
    "credentialEnvKeysJson" TEXT,
    "hasCredentials" BOOLEAN NOT NULL DEFAULT false,
    "scopesJson" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "apiStatus" TEXT NOT NULL DEFAULT 'not_configured',
    "apiNote" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "externalUserId" TEXT,
    "externalUsername" TEXT,
    "externalUrl" TEXT,
    "accountType" TEXT,
    "scopes" TEXT,
    "tokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenIssuedAt" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "rawProfileJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "approvalMode" TEXT NOT NULL DEFAULT 'auto',
    "maxPostsPerDay" INTEGER NOT NULL DEFAULT 10,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMinutes" INTEGER NOT NULL DEFAULT 30,
    "dedupeWindowDays" INTEGER NOT NULL DEFAULT 30,
    "contentTypesJson" TEXT NOT NULL DEFAULT '["celebrity","membership","event","article","promo"]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialSchedule" (
    "id" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "contentTypesJson" TEXT NOT NULL DEFAULT '[]',
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "intervalMinutes" INTEGER,
    "timesJson" TEXT NOT NULL DEFAULT '[]',
    "weekdaysJson" TEXT,
    "maxPerDay" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialQueueItem" (
    "id" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "accountId" TEXT,
    "contentType" TEXT NOT NULL,
    "contentRefId" TEXT,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "mediaJson" TEXT,
    "linkUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "dedupeHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "queueItemId" TEXT,
    "platformKey" TEXT NOT NULL,
    "accountId" TEXT,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "mediaJson" TEXT,
    "linkUrl" TEXT,
    "contentType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPostLog" (
    "id" TEXT NOT NULL,
    "queueItemId" TEXT,
    "platformKey" TEXT NOT NULL,
    "postId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "author" TEXT,
    "category" TEXT NOT NULL DEFAULT 'News',
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "autoPostEnabled" BOOLEAN NOT NULL DEFAULT true,
    "linkedCelebrityId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaAsset" (
    "id" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storage" TEXT NOT NULL DEFAULT 'db',
    "dataUri" TEXT,
    "url" TEXT,
    "platformKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "redirectTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialPlatform_key_key" ON "SocialPlatform"("key");

-- CreateIndex
CREATE INDEX "SocialPlatform_enabled_idx" ON "SocialPlatform"("enabled");

-- CreateIndex
CREATE INDEX "SocialPlatform_apiStatus_idx" ON "SocialPlatform"("apiStatus");

-- CreateIndex
CREATE INDEX "SocialAccount_platformKey_idx" ON "SocialAccount"("platformKey");

-- CreateIndex
CREATE INDEX "SocialAccount_status_idx" ON "SocialAccount"("status");

-- CreateIndex
CREATE INDEX "SocialSchedule_enabled_idx" ON "SocialSchedule"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "SocialSchedule_platformKey_key" ON "SocialSchedule"("platformKey");

-- CreateIndex
CREATE INDEX "SocialQueueItem_status_idx" ON "SocialQueueItem"("status");

-- CreateIndex
CREATE INDEX "SocialQueueItem_platformKey_idx" ON "SocialQueueItem"("platformKey");

-- CreateIndex
CREATE INDEX "SocialQueueItem_scheduledFor_idx" ON "SocialQueueItem"("scheduledFor");

-- CreateIndex
CREATE INDEX "SocialQueueItem_contentType_idx" ON "SocialQueueItem"("contentType");

-- CreateIndex
CREATE UNIQUE INDEX "SocialQueueItem_contentKey_platformKey_key" ON "SocialQueueItem"("contentKey", "platformKey");

-- CreateIndex
CREATE INDEX "SocialPost_platformKey_idx" ON "SocialPost"("platformKey");

-- CreateIndex
CREATE INDEX "SocialPost_status_idx" ON "SocialPost"("status");

-- CreateIndex
CREATE INDEX "SocialPost_publishedAt_idx" ON "SocialPost"("publishedAt");

-- CreateIndex
CREATE INDEX "SocialPostLog_queueItemId_idx" ON "SocialPostLog"("queueItemId");

-- CreateIndex
CREATE INDEX "SocialPostLog_platformKey_idx" ON "SocialPostLog"("platformKey");

-- CreateIndex
CREATE INDEX "SocialPostLog_postId_idx" ON "SocialPostLog"("postId");

-- CreateIndex
CREATE INDEX "SocialPostLog_createdAt_idx" ON "SocialPostLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialArticle_slug_key" ON "SocialArticle"("slug");

-- CreateIndex
CREATE INDEX "SocialArticle_status_idx" ON "SocialArticle"("status");

-- CreateIndex
CREATE INDEX "SocialArticle_publishedAt_idx" ON "SocialArticle"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialOAuthState_state_key" ON "SocialOAuthState"("state");

-- CreateIndex
CREATE INDEX "SocialOAuthState_state_idx" ON "SocialOAuthState"("state");

-- CreateIndex
CREATE INDEX "SocialOAuthState_expiresAt_idx" ON "SocialOAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_platformKey_fkey" FOREIGN KEY ("platformKey") REFERENCES "SocialPlatform"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialSchedule" ADD CONSTRAINT "SocialSchedule_platformKey_fkey" FOREIGN KEY ("platformKey") REFERENCES "SocialPlatform"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialQueueItem" ADD CONSTRAINT "SocialQueueItem_platformKey_fkey" FOREIGN KEY ("platformKey") REFERENCES "SocialPlatform"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialQueueItem" ADD CONSTRAINT "SocialQueueItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_platformKey_fkey" FOREIGN KEY ("platformKey") REFERENCES "SocialPlatform"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostLog" ADD CONSTRAINT "SocialPostLog_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "SocialQueueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostLog" ADD CONSTRAINT "SocialPostLog_platformKey_fkey" FOREIGN KEY ("platformKey") REFERENCES "SocialPlatform"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialArticle" ADD CONSTRAINT "SocialArticle_linkedCelebrityId_fkey" FOREIGN KEY ("linkedCelebrityId") REFERENCES "Celebrity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
