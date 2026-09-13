-- Add an admin-controlled switch that pauses the always-on AI chat so fans
-- only get manual replies from the admin inbox (global kill-switch lives in AppSetting).
-- Applied manually to the live database via `prisma db execute` because the
-- pre-existing migration chain (duplicate Celebrity.bio in add_celebrity_bio)
-- prevents a clean shadow-DB replay.
-- AlterTable
ALTER TABLE "Celebrity" ADD COLUMN     "chatAutoReplyEnabled" BOOLEAN NOT NULL DEFAULT true;