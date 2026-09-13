-- AI assistant memory per conversation: a running note of important things
-- the fan and the celebrity talked about (hopes, money situation, family,
-- favorites, promises, love talk). Plain text note maintained by the assistant.
ALTER TABLE "ChatConversation" ADD COLUMN "aiMemory" TEXT NOT NULL DEFAULT '';