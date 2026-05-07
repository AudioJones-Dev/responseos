-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('lead', 'active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('aj_admin', 'operator', 'client_admin', 'client_viewer');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('call', 'sms', 'form', 'manual', 'crm_sync');

-- CreateEnum
CREATE TYPE "CallProvider" AS ENUM ('twilio', 'retell', 'vapi', 'bland', 'manual');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('answered', 'missed', 'voicemail', 'spam', 'failed', 'completed');

-- CreateEnum
CREATE TYPE "CallSentiment" AS ENUM ('positive', 'neutral', 'negative');

-- CreateEnum
CREATE TYPE "LeadEventSource" AS ENUM ('phone', 'sms', 'website', 'manual', 'outbound');

-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM ('missed_call', 'answered_call', 'quote_request', 'booking_request', 'qualified_lead', 'spam', 'follow_up_needed', 'appointment_booked', 'quote_sent', 'job_won', 'job_lost');

-- CreateEnum
CREATE TYPE "LeadEventStatus" AS ENUM ('new', 'qualified', 'unqualified', 'booked', 'quoted', 'won', 'lost', 'archived');

-- CreateEnum
CREATE TYPE "LeadUrgency" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "QualificationTimeline" AS ENUM ('same_day', 'this_week', 'this_month', 'unknown');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('qualified', 'maybe', 'unqualified', 'spam');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('google', 'calcom', 'ghl', 'manual');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('requested', 'reviewing', 'sent', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('missed_call', 'after_hours_call', 'new_lead', 'quote_requested', 'booking_created', 'no_response', 'job_completed');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('active', 'paused', 'draft');

-- CreateEnum
CREATE TYPE "WorkflowProvider" AS ENUM ('n8n', 'make', 'internal');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email', 'in_app', 'slack');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'in_review', 'delivered', 'signed', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "FitDiagnosis" AS ENUM ('ai_fit', 'borderline', 'no_fit');

-- CreateEnum
CREATE TYPE "EngagementTier" AS ENUM ('recovery_core', 'recovery_pro', 'recovery_performance');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('active', 'paused', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "OutcomeFeeKind" AS ENUM ('per_qualified_appointment', 'per_verified_recovered_lead', 'pct_recovered_revenue', 'threshold_bonus');

-- CreateEnum
CREATE TYPE "UsageModel" AS ENUM ('bundled_with_cap', 'passthrough_with_margin');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'system', 'webhook');

-- CreateEnum
CREATE TYPE "WebhookProcessStatus" AS ENUM ('received', 'processed', 'rejected', 'duplicate', 'error');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "website_url" TEXT,
    "primary_phone" TEXT,
    "timezone" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'lead',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "source" "ContactSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "provider" "CallProvider" NOT NULL,
    "provider_call_id" TEXT,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "recording_url" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "sentiment" "CallSentiment",
    "spam_score" DOUBLE PRECISION,
    "lead_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "call_id" TEXT,
    "source" "LeadEventSource" NOT NULL,
    "event_type" "LeadEventType" NOT NULL,
    "status" "LeadEventStatus" NOT NULL DEFAULT 'new',
    "urgency" "LeadUrgency" NOT NULL DEFAULT 'medium',
    "estimated_value" INTEGER,
    "recovered_value" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQualification" (
    "id" TEXT NOT NULL,
    "lead_event_id" TEXT NOT NULL,
    "service_needed" TEXT,
    "service_area_match" BOOLEAN NOT NULL,
    "budget_range" TEXT,
    "timeline" "QualificationTimeline",
    "property_type" TEXT,
    "decision_maker" BOOLEAN,
    "qualification_score" INTEGER NOT NULL,
    "qualification_status" "QualificationStatus" NOT NULL,
    "disqualification_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "lead_event_id" TEXT,
    "calendar_provider" "CalendarProvider" NOT NULL,
    "external_event_id" TEXT,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'scheduled',
    "location" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "lead_event_id" TEXT,
    "service_type" TEXT NOT NULL,
    "description" TEXT,
    "photos" TEXT[],
    "property_address" TEXT,
    "estimated_value" INTEGER,
    "status" "QuoteStatus" NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" "AutomationTriggerType" NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'draft',
    "workflow_provider" "WorkflowProvider" NOT NULL,
    "webhook_url" TEXT,
    "config_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_event_id" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueMetrics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "missed_calls" INTEGER NOT NULL DEFAULT 0,
    "calls_answered_by_ai" INTEGER NOT NULL DEFAULT 0,
    "qualified_leads" INTEGER NOT NULL DEFAULT 0,
    "appointments_booked" INTEGER NOT NULL DEFAULT 0,
    "quotes_requested" INTEGER NOT NULL DEFAULT 0,
    "quotes_sent" INTEGER NOT NULL DEFAULT 0,
    "jobs_won" INTEGER NOT NULL DEFAULT 0,
    "estimated_recovered_revenue" INTEGER NOT NULL DEFAULT 0,
    "verified_recovered_revenue" INTEGER NOT NULL DEFAULT 0,
    "admin_hours_saved" INTEGER NOT NULL DEFAULT 0,
    "response_time_avg_seconds" INTEGER NOT NULL DEFAULT 0,
    "roi_multiple" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReport" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'draft',
    "inputs_json" JSONB NOT NULL,
    "readiness_score" INTEGER,
    "revenue_leak_estimate" INTEGER,
    "fit_diagnosis" "FitDiagnosis",
    "current_workflow_map" JSONB,
    "recommended_workflow_map" JSONB,
    "implementation_scope" TEXT,
    "projected_roi_multiple" DOUBLE PRECISION,
    "proposed_tier" "EngagementTier",
    "proposed_setup_cents" INTEGER,
    "proposed_monthly_cents" INTEGER,
    "proposed_outcome_terms" JSONB,
    "delivered_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assessment_report_id" TEXT NOT NULL,
    "tier" "EngagementTier" NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'active',
    "setup_fee_cents" INTEGER NOT NULL,
    "monthly_fee_cents" INTEGER NOT NULL,
    "outcome_fee_kind" "OutcomeFeeKind",
    "outcome_fee_terms_json" JSONB,
    "usage_model" "UsageModel" NOT NULL,
    "included_voice_minutes" INTEGER,
    "passthrough_margin_pct" INTEGER,
    "is_founding_pilot" BOOLEAN NOT NULL DEFAULT false,
    "pilot_ends_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_user_id" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata_json" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw_body" TEXT NOT NULL,
    "signature_header" TEXT,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "dedupe_hash" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "process_status" "WebhookProcessStatus" NOT NULL DEFAULT 'received',
    "process_error" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");

-- CreateIndex
CREATE INDEX "Contact_organization_id_idx" ON "Contact"("organization_id");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Call_organization_id_idx" ON "Call"("organization_id");

-- CreateIndex
CREATE INDEX "Call_contact_id_idx" ON "Call"("contact_id");

-- CreateIndex
CREATE INDEX "Call_started_at_idx" ON "Call"("started_at");

-- CreateIndex
CREATE INDEX "LeadEvent_organization_id_idx" ON "LeadEvent"("organization_id");

-- CreateIndex
CREATE INDEX "LeadEvent_contact_id_idx" ON "LeadEvent"("contact_id");

-- CreateIndex
CREATE INDEX "LeadEvent_call_id_idx" ON "LeadEvent"("call_id");

-- CreateIndex
CREATE INDEX "LeadEvent_status_idx" ON "LeadEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadQualification_lead_event_id_key" ON "LeadQualification"("lead_event_id");

-- CreateIndex
CREATE INDEX "Booking_organization_id_idx" ON "Booking"("organization_id");

-- CreateIndex
CREATE INDEX "Booking_contact_id_idx" ON "Booking"("contact_id");

-- CreateIndex
CREATE INDEX "Booking_lead_event_id_idx" ON "Booking"("lead_event_id");

-- CreateIndex
CREATE INDEX "Booking_start_time_idx" ON "Booking"("start_time");

-- CreateIndex
CREATE INDEX "QuoteRequest_organization_id_idx" ON "QuoteRequest"("organization_id");

-- CreateIndex
CREATE INDEX "QuoteRequest_contact_id_idx" ON "QuoteRequest"("contact_id");

-- CreateIndex
CREATE INDEX "Automation_organization_id_idx" ON "Automation"("organization_id");

-- CreateIndex
CREATE INDEX "Automation_trigger_type_idx" ON "Automation"("trigger_type");

-- CreateIndex
CREATE INDEX "Notification_organization_id_idx" ON "Notification"("organization_id");

-- CreateIndex
CREATE INDEX "Notification_lead_event_id_idx" ON "Notification"("lead_event_id");

-- CreateIndex
CREATE INDEX "RevenueMetrics_organization_id_idx" ON "RevenueMetrics"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueMetrics_organization_id_period_start_period_end_key" ON "RevenueMetrics"("organization_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "AssessmentReport_organization_id_idx" ON "AssessmentReport"("organization_id");

-- CreateIndex
CREATE INDEX "AssessmentReport_status_idx" ON "AssessmentReport"("status");

-- CreateIndex
CREATE INDEX "AssessmentReport_created_at_idx" ON "AssessmentReport"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_assessment_report_id_key" ON "Engagement"("assessment_report_id");

-- CreateIndex
CREATE INDEX "Engagement_organization_id_idx" ON "Engagement"("organization_id");

-- CreateIndex
CREATE INDEX "Engagement_status_idx" ON "Engagement"("status");

-- CreateIndex
CREATE INDEX "Engagement_signed_at_idx" ON "Engagement"("signed_at");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_idx" ON "AuditLog"("organization_id");

-- CreateIndex
CREATE INDEX "AuditLog_actor_user_id_idx" ON "AuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupe_hash_key" ON "WebhookEvent"("dedupe_hash");

-- CreateIndex
CREATE INDEX "WebhookEvent_organization_id_idx" ON "WebhookEvent"("organization_id");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "WebhookEvent_received_at_idx" ON "WebhookEvent"("received_at");

-- CreateIndex
CREATE INDEX "WebhookEvent_process_status_idx" ON "WebhookEvent"("process_status");

