-- AlterTable
ALTER TABLE "Celebrity" ADD COLUMN     "chatAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatAccessOffMessage" TEXT;

-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN     "aiMode" TEXT NOT NULL DEFAULT 'auto';