-- ResponseOS v0.2 closeout step 2.3, PR 31A: communication substrate.
--
-- Purely additive migration. Adds:
--   * Six new enum types.
--   * Three new tables: ProviderConnection, Conversation, SmsMessage.
--   * Indexes + unique constraints per the planning artifact §3.1–3.3 and
--     ADR-0020 (provider credential encryption posture).
--
-- No existing tables, columns, enums, or indexes are altered or dropped.
-- No foreign-key constraints are created (the schema continues the
-- Prisma logical-FK discipline established in 0001/0002/0003).
--
-- See:
--   - docs/product/RESPONSEOS_V0_2_REMAINING_MODELS_IMPLEMENTATION_PLAN.md §3
--   - docs/DECISIONS.md ADR-0020 (provider credential encryption)
--   - issue #27 (roadmap checkpoint)

-- CreateEnum
CREATE TYPE "ProviderConnectionProvider" AS ENUM ('twilio', 'grok', 'openai', 'retell', 'vapi', 'bland', 'hubspot', 'google_calendar', 'calcom', 'stripe');

-- CreateEnum
CREATE TYPE "ProviderConnectionStatus" AS ENUM ('connected', 'disconnected', 'error', 'expired');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'archived', 'blocked', 'spam');

-- CreateEnum
CREATE TYPE "SmsProvider" AS ENUM ('twilio', 'manual');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "SmsMessageStatus" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'failed', 'received');

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider" "ProviderConnectionProvider" NOT NULL,
    "credentials_encrypted" BYTEA NOT NULL,
    "oauth_refresh_token_encrypted" BYTEA,
    "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'connected',
    "scopes" TEXT[],
    "connected_by" TEXT NOT NULL,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "business_number" TEXT NOT NULL,
    "peer_number" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'open',
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "provider" "SmsProvider" NOT NULL,
    "provider_message_id" TEXT,
    "direction" "SmsDirection" NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SmsMessageStatus" NOT NULL,
    "segment_count" INTEGER NOT NULL DEFAULT 1,
    "error_code" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderConnection_account_id_idx" ON "ProviderConnection"("account_id");

-- CreateIndex
CREATE INDEX "ProviderConnection_status_idx" ON "ProviderConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_account_id_provider_key" ON "ProviderConnection"("account_id", "provider");

-- CreateIndex
CREATE INDEX "Conversation_account_id_idx" ON "Conversation"("account_id");

-- CreateIndex
CREATE INDEX "Conversation_contact_id_idx" ON "Conversation"("contact_id");

-- CreateIndex
CREATE INDEX "Conversation_last_message_at_idx" ON "Conversation"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_account_id_business_number_peer_number_key" ON "Conversation"("account_id", "business_number", "peer_number");

-- CreateIndex
CREATE INDEX "SmsMessage_account_id_idx" ON "SmsMessage"("account_id");

-- CreateIndex
CREATE INDEX "SmsMessage_conversation_id_idx" ON "SmsMessage"("conversation_id");

-- CreateIndex
CREATE INDEX "SmsMessage_created_at_idx" ON "SmsMessage"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "SmsMessage_provider_provider_message_id_key" ON "SmsMessage"("provider", "provider_message_id");
