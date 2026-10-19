CREATE TABLE "GrokCallSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "account_id" TEXT NOT NULL, "capture_id" TEXT NOT NULL,
 "provider_call_id" TEXT NOT NULL, "assignment_id" TEXT NOT NULL, "generation" INTEGER NOT NULL,
 "call_session_id" TEXT NOT NULL, "call_leg_id" TEXT NOT NULL, "authority_digest" TEXT NOT NULL,
 "correlation_hash" TEXT NOT NULL, "xai_call_id" TEXT, "worker_token" TEXT,
 "lease_expires_at" TIMESTAMP(3) NOT NULL, "stopped_at" TIMESTAMP(3), "stop_reason" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GrokCallSession_capture_id_account_id_provider_call_id_fkey" FOREIGN KEY ("capture_id", "account_id", "provider_call_id") REFERENCES "CallCaptureSession"("id", "account_id", "provider_call_id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "GrokCallSession_capture_id_key" ON "GrokCallSession"("capture_id");
CREATE UNIQUE INDEX "GrokCallSession_correlation_hash_key" ON "GrokCallSession"("correlation_hash");
CREATE UNIQUE INDEX "GrokCallSession_xai_call_id_key" ON "GrokCallSession"("xai_call_id");
CREATE INDEX "GrokCallSession_stopped_at_lease_expires_at_idx" ON "GrokCallSession"("stopped_at", "lease_expires_at");
CREATE TABLE "GrokCallCommand" (
 "id" TEXT NOT NULL PRIMARY KEY, "session_id" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "resource" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued',
 "consumed_at" TIMESTAMP(3), "result_at" TIMESTAMP(3),
 CONSTRAINT "GrokCallCommand_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "GrokCallSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "grok_command_kind" CHECK ("kind" IN ('handoff','join','telnyx_hangup','xai_hangup')),
 CONSTRAINT "grok_command_status" CHECK ("status" IN ('queued','uncertain','accepted','failed','disabled'))
);
CREATE UNIQUE INDEX "GrokCallCommand_session_id_kind_key" ON "GrokCallCommand"("session_id","kind");
CREATE TABLE "GrokIncomingReceipt" (
 "event_id" TEXT NOT NULL PRIMARY KEY, "session_id" TEXT NOT NULL, "call_id" TEXT NOT NULL,
 "body_digest" TEXT NOT NULL, "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GrokIncomingReceipt_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "GrokCallSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE FUNCTION grok_authority_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'grok_authority_is_retained'; END IF;
 IF TG_TABLE_NAME = 'GrokCallSession' THEN
  IF ROW(NEW.id,NEW.account_id,NEW.capture_id,NEW.provider_call_id,NEW.assignment_id,NEW.generation,NEW.call_session_id,NEW.call_leg_id,NEW.authority_digest,NEW.correlation_hash,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.capture_id,OLD.provider_call_id,OLD.assignment_id,OLD.generation,OLD.call_session_id,OLD.call_leg_id,OLD.authority_digest,OLD.correlation_hash,OLD.created_at)
   OR (OLD.xai_call_id IS NOT NULL AND NEW.xai_call_id IS DISTINCT FROM OLD.xai_call_id)
   OR (OLD.worker_token IS NOT NULL AND NEW.worker_token IS DISTINCT FROM OLD.worker_token)
   OR (OLD.stopped_at IS NOT NULL AND ROW(NEW.stopped_at,NEW.stop_reason,NEW.lease_expires_at) IS DISTINCT FROM ROW(OLD.stopped_at,OLD.stop_reason,OLD.lease_expires_at)) THEN RAISE EXCEPTION 'grok_authority_is_immutable'; END IF;
 ELSIF TG_TABLE_NAME = 'GrokCallCommand' THEN
  IF ROW(NEW.id,NEW.session_id,NEW.kind,NEW.resource) IS DISTINCT FROM ROW(OLD.id,OLD.session_id,OLD.kind,OLD.resource)
   OR (OLD.consumed_at IS NOT NULL AND (NEW.consumed_at IS DISTINCT FROM OLD.consumed_at OR NEW.status='queued'))
   OR (OLD.result_at IS NOT NULL AND ROW(NEW.result_at,NEW.status) IS DISTINCT FROM ROW(OLD.result_at,OLD.status)) THEN RAISE EXCEPTION 'grok_command_is_consumed'; END IF;
 ELSE RAISE EXCEPTION 'grok_receipt_is_immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER grok_session_guard BEFORE UPDATE OR DELETE ON "GrokCallSession" FOR EACH ROW EXECUTE FUNCTION grok_authority_guard();
CREATE TRIGGER grok_command_guard BEFORE UPDATE OR DELETE ON "GrokCallCommand" FOR EACH ROW EXECUTE FUNCTION grok_authority_guard();
CREATE TRIGGER grok_receipt_guard BEFORE UPDATE OR DELETE ON "GrokIncomingReceipt" FOR EACH ROW EXECUTE FUNCTION grok_authority_guard();
