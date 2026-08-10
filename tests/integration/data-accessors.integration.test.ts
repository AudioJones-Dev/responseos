import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  Assessments,
  AuditLogs,
  Automations,
  Appointments,
  CallSegments,
  CallTranscripts,
  Calls,
  Contacts,
  Conversations,
  Engagements,
  LeadQualifications,
  Leads,
  Notifications,
  Accounts,
  ProviderConnections,
  QaLogs,
  Quotes,
  RevenueMetrics,
  SmsMessages,
  Users,
  WebhookEvents,
  WorkflowRuns,
} from "@/lib/data";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

describe("data accessors against Postgres", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  test("account accessors list and fetch seeded tenants", async () => {
    const list = await Accounts.listAccounts();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((org) => org.id)).toEqual([
      "org_mock_1",
      "org_mock_2",
      "acct_internal_demo_tyrone",
      "acct_responseos_demo",
    ]);

    const found = await Accounts.getAccountById("org_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.slug).toBe("sunshine-hvac");
  });

  test("user accessors list and fetch users", async () => {
    const list = await Users.listUsers({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((user) => user.id)).toEqual(["user_acme_owner_1", "user_acme_viewer_1"]);

    const found = await Users.getUserById("user_acme_owner_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.role).toBe("client_admin");
  });

  test("contact accessors list and fetch contacts", async () => {
    const list = await Contacts.listContacts({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(2);

    const found = await Contacts.getContactById("contact_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.email).toBe("jordan.reyes@example.com");
  });

  test("call accessors preserve default ordering and fetch calls", async () => {
    const list = await Calls.listCalls({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((call) => call.id)).toEqual(["call_mock_3", "call_mock_2", "call_mock_1"]);

    const found = await Calls.getCallById("call_mock_2");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.summary).toContain("AC quote request");
  });

  test("lead accessors list and fetch leads", async () => {
    const list = await Leads.listLeads({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data[0].id).toBe("lead_mock_11");

    const found = await Leads.getLeadById("lead_mock_2");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.status).toBe("qualified");
  });

  test("lead qualification accessor fetches by lead id", async () => {
    const result = await LeadQualifications.getLeadQualificationByLeadId("lead_mock_2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.qualification_status).toBe("qualified");
  });

  test("appointment accessors list and fetch appointments", async () => {
    const list = await Appointments.listAppointments({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((booking) => booking.id)).toEqual(["booking_mock_1"]);

    const found = await Appointments.getAppointmentById("booking_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.status).toBe("confirmed");
  });

  test("quote accessors list and fetch quote requests", async () => {
    const list = await Quotes.listQuoteRequests({ accountId: "org_mock_2" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((quote) => quote.id)).toEqual(["quote_mock_2"]);

    const found = await Quotes.getQuoteRequestById("quote_mock_2");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.service_type).toBe("Roof replacement");
  });

  test("automation and notification list accessors read seeded rows", async () => {
    const automations = await Automations.listAutomations({ accountId: "org_mock_1" });
    expect(automations.ok).toBe(true);
    if (!automations.ok) return;
    expect(Array.isArray(automations.data)).toBe(true);

    const notifications = await Notifications.listNotifications({ accountId: "org_mock_1" });
    expect(notifications.ok).toBe(true);
    if (!notifications.ok) return;
    expect(Array.isArray(notifications.data)).toBe(true);
  });

  test("revenue metric accessors list and fetch current metrics", async () => {
    const list = await RevenueMetrics.listRevenueMetrics({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((row) => row.id)).toEqual(["rev_mock_current", "rev_mock_prev_1", "rev_mock_prev_2"]);

    const current = await RevenueMetrics.getCurrentRevenueMetrics({ accountId: "org_mock_1" });
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(current.data?.id).toBe("rev_mock_current");
  });

  test("assessment and engagement accessors list and fetch v0.2 records", async () => {
    const assessments = await Assessments.listAssessmentReports({ accountId: "org_mock_1" });
    expect(assessments.ok).toBe(true);
    if (!assessments.ok) return;
    expect(assessments.data.map((assessment) => assessment.id)).toEqual(["assessment_mock_1"]);

    const assessment = await Assessments.getAssessmentReportById("assessment_mock_1");
    expect(assessment.ok).toBe(true);
    if (!assessment.ok) return;
    expect(assessment.data.readiness_score).toBe(72);

    const engagements = await Engagements.listEngagements({ accountId: "org_mock_1" });
    expect(engagements.ok).toBe(true);
    if (!engagements.ok) return;
    expect(engagements.data.map((engagement) => engagement.id)).toEqual(["engagement_mock_1"]);

    const engagement = await Engagements.getEngagementById("engagement_mock_1");
    expect(engagement.ok).toBe(true);
    if (!engagement.ok) return;
    expect(engagement.data.assessment_report_id).toBe("assessment_mock_1");
  });

  test("audit log accessors record and list rows", async () => {
    const recorded = await AuditLogs.recordAuditLog({
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      action: "integration.audit.recorded",
      target_type: "LeadEvent",
      target_id: "lead_mock_2",
      metadata_json: { before: "new", after: "qualified" },
      ip_address: "127.0.0.1",
      user_agent: "vitest",
    });
    expect(recorded).toEqual({ ok: true, data: { recorded: true } });

    const list = await AuditLogs.listAuditLogs({ accountId: "org_mock_1", action: "integration.audit.recorded" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ action: "integration.audit.recorded", target_id: "lead_mock_2" });
  });

  test("webhook event accessors compute hashes, record idempotently, and list rows", async () => {
    const hash = WebhookEvents.computeDedupeHash("twilio", "event_test_001");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const first = await WebhookEvents.recordWebhookEvent({
      account_id: "org_mock_1",
      provider: "twilio",
      provider_event_id: "event_test_001",
      event_type: "call.completed",
      raw_body: JSON.stringify({ id: "event_test_001" }),
      signature_header: "signature",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.process_status).toBe("received");

    const duplicate = await WebhookEvents.recordWebhookEvent({
      provider: "twilio",
      provider_event_id: "event_test_001",
      event_type: "call.completed",
      raw_body: "{}",
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.data).toEqual({ id: first.data.id, process_status: "duplicate" });

    const list = await WebhookEvents.listWebhookEvents({ provider: "twilio" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((event) => event.id)).toContain(first.data.id);

    expect(await prisma.webhookEvent.count({ where: { dedupe_hash: hash } })).toBe(1);
  });

  test("provider connection accessors list seeded rows and never return ciphertext", async () => {
    const list = await ProviderConnections.listProviderConnections({
      accountId: "org_mock_1",
    });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((c) => c.provider).sort()).toEqual(["hubspot", "twilio"]);

    // Public shape never carries ciphertext bytes; the type-level guarantee
    // is reinforced here as a runtime assertion.
    for (const row of list.data) {
      expect("credentials_encrypted" in (row as object)).toBe(false);
      expect("oauth_refresh_token_encrypted" in (row as object)).toBe(false);
    }

    const found = await ProviderConnections.getProviderConnectionByProvider({
      accountId: "org_mock_1",
      provider: "twilio",
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data?.id).toBe("pconn_mock_1");

    const missing = await ProviderConnections.getProviderConnectionByProvider({
      accountId: "org_mock_2",
      provider: "twilio",
    });
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.data).toBeNull();
  });

  test("conversation accessors list seeded threads and find-or-create is idempotent", async () => {
    const list = await Conversations.listConversations({ accountId: "org_mock_1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((c) => c.id)).toEqual(["conv_mock_1"]);

    const found = await Conversations.getConversationById("conv_mock_1");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.peer_number).toBe("+15555550199");

    const first = await Conversations.findOrCreateConversation({
      accountId: "org_mock_1",
      businessNumber: "+15555550100",
      peerNumber: "+15555550199",
      contactId: "contact_mock_1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.id).toBe("conv_mock_1");

    const second = await Conversations.findOrCreateConversation({
      accountId: "org_mock_1",
      businessNumber: "+15555550100",
      peerNumber: "+15555550199",
      contactId: "contact_mock_1",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.id).toBe(first.data.id);
  });

  test("sms message accessors list per conversation and dedupe on provider_message_id", async () => {
    const list = await SmsMessages.listSmsMessagesByConversation({
      accountId: "org_mock_1",
      conversationId: "conv_mock_1",
    });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((m) => m.id)).toEqual(["sms_mock_1", "sms_mock_2"]);

    const first = await SmsMessages.recordSmsMessage({
      account_id: "org_mock_1",
      conversation_id: "conv_mock_1",
      provider: "twilio",
      provider_message_id: "SM_test_new",
      direction: "inbound",
      from_number: "+15555550199",
      to_number: "+15555550100",
      body: "follow-up question",
      status: "received",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.provider_message_id).toBe("SM_test_new");

    const duplicate = await SmsMessages.recordSmsMessage({
      account_id: "org_mock_1",
      conversation_id: "conv_mock_1",
      provider: "twilio",
      provider_message_id: "SM_test_new",
      direction: "inbound",
      from_number: "+15555550199",
      to_number: "+15555550100",
      body: "follow-up question",
      status: "received",
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.data.id).toBe(first.data.id);

    expect(
      await prisma.smsMessage.count({
        where: { provider: "twilio", provider_message_id: "SM_test_new" },
      }),
    ).toBe(1);
  });

  test("call segment accessors list ordered turns and idempotent record on (call_id, sequence)", async () => {
    const list = await CallSegments.listCallSegmentsByCall({
      accountId: "org_mock_1",
      callId: "call_mock_2",
    });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((s) => s.sequence)).toEqual([1, 2]);
    expect(list.data.map((s) => s.speaker)).toEqual(["caller", "agent"]);

    const first = await CallSegments.recordCallSegment({
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      sequence: 3,
      speaker: "caller",
      text: "Follow-up question text",
      started_at: new Date("2026-05-04T15:15:20.000Z"),
      ended_at: new Date("2026-05-04T15:15:25.000Z"),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.sequence).toBe(3);

    const duplicate = await CallSegments.recordCallSegment({
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      sequence: 3,
      speaker: "caller",
      text: "follow-up duplicate write",
      started_at: new Date("2026-05-04T15:15:20.000Z"),
      ended_at: new Date("2026-05-04T15:15:25.000Z"),
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.data.id).toBe(first.data.id);
    // The original text wins because the writer is a true no-op on
    // (call_id, sequence) collision — re-runs of the normalizer must
    // not silently overwrite earlier turn content.
    expect(duplicate.data.text).toBe("Follow-up question text");
  });

  test("call transcript accessor returns public shape only — no raw_ref or redacted_ref exposed", async () => {
    const found = await CallTranscripts.getCallTranscriptByCall({
      accountId: "org_mock_1",
      callId: "call_mock_2",
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data).not.toBeNull();
    if (!found.data) return;
    expect(found.data.inline_text).toContain("Caller asked");
    // Hard guardrail: privileged raw-transcript surface must not exist
    // in 31B. The public shape strips both object-storage pointers.
    expect("raw_ref" in (found.data as object)).toBe(false);
    expect("redacted_ref" in (found.data as object)).toBe(false);

    const missing = await CallTranscripts.getCallTranscriptByCall({
      accountId: "org_mock_1",
      callId: "call_mock_1",
    });
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.data).toBeNull();
  });

  test("workflow run accessors list seeded runs, filter by status, dedupe on workflow_run_id, and finalize is monotonic", async () => {
    const list = await WorkflowRuns.listWorkflowRuns({});
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((r) => r.id).sort()).toEqual(["wfr_mock_1", "wfr_mock_2"]);

    const failed = await WorkflowRuns.listWorkflowRuns({ status: "failed" });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.data.map((r) => r.id)).toEqual(["wfr_mock_2"]);

    const byWorkflow = await WorkflowRuns.listWorkflowRuns({
      workflowId: "missed_call_recovery",
    });
    expect(byWorkflow.ok).toBe(true);
    if (!byWorkflow.ok) return;
    expect(byWorkflow.data.map((r) => r.id)).toEqual(["wfr_mock_1"]);

    // Dedupe: re-recording the same workflow_run_id is a no-op.
    const first = await WorkflowRuns.recordWorkflowRun({
      account_id: "org_mock_1",
      workflow_run_id: "n8n_run_test_dedupe",
      workflow_id: "test_dedupe",
      provider: "n8n",
      started_at: new Date("2026-05-04T18:00:00.000Z"),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.status).toBe("started");

    const replay = await WorkflowRuns.recordWorkflowRun({
      account_id: "org_mock_1",
      workflow_run_id: "n8n_run_test_dedupe",
      workflow_id: "test_dedupe",
      provider: "n8n",
      started_at: new Date("2026-05-04T18:00:00.000Z"),
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.data.id).toBe(first.data.id);

    // Monotonic finalize: started -> completed.
    const finalized = await WorkflowRuns.finalizeWorkflowRun({
      workflow_run_id: "n8n_run_test_dedupe",
      status: "completed",
      ended_at: new Date("2026-05-04T18:00:05.000Z"),
    });
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    expect(finalized.data.status).toBe("completed");
    expect(finalized.data.ended_at).toBe("2026-05-04T18:00:05.000Z");

    // Already-terminal finalize is a no-op (status stays `completed`,
    // attempted `failed` does not overwrite).
    const noop = await WorkflowRuns.finalizeWorkflowRun({
      workflow_run_id: "n8n_run_test_dedupe",
      status: "failed",
      ended_at: new Date("2026-05-04T18:00:10.000Z"),
      error_message: "should not overwrite",
    });
    expect(noop.ok).toBe(true);
    if (!noop.ok) return;
    expect(noop.data.status).toBe("completed");
    expect(noop.data.error_message).toBeUndefined();

    const fetched = await WorkflowRuns.getWorkflowRunByRunId(
      "n8n_run_test_dedupe",
    );
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.data?.status).toBe("completed");

    expect(
      await prisma.workflowRun.count({
        where: { workflow_run_id: "n8n_run_test_dedupe" },
      }),
    ).toBe(1);

    const concurrentRecords = await Promise.all([
      WorkflowRuns.recordWorkflowRun({
        account_id: "org_mock_1",
        workflow_run_id: "n8n_run_test_concurrent_record",
        workflow_id: "test_concurrent_record",
        provider: "n8n",
        started_at: new Date("2026-05-04T19:00:00.000Z"),
      }),
      WorkflowRuns.recordWorkflowRun({
        account_id: "org_mock_1",
        workflow_run_id: "n8n_run_test_concurrent_record",
        workflow_id: "test_concurrent_record",
        provider: "n8n",
        started_at: new Date("2026-05-04T19:00:00.000Z"),
      }),
    ]);
    for (const result of concurrentRecords) {
      expect(result.ok).toBe(true);
      if (!result.ok) return;
    }
    const [firstConcurrent, secondConcurrent] = concurrentRecords;
    if (!firstConcurrent.ok || !secondConcurrent.ok) return;
    expect(firstConcurrent.data.id).toBe(secondConcurrent.data.id);
    expect(
      await prisma.workflowRun.count({
        where: { workflow_run_id: "n8n_run_test_concurrent_record" },
      }),
    ).toBe(1);

    await WorkflowRuns.recordWorkflowRun({
      account_id: "org_mock_1",
      workflow_run_id: "n8n_run_test_concurrent_finalize",
      workflow_id: "test_concurrent_finalize",
      provider: "n8n",
      started_at: new Date("2026-05-04T20:00:00.000Z"),
    });
    const concurrentFinalizes = await Promise.all([
      WorkflowRuns.finalizeWorkflowRun({
        workflow_run_id: "n8n_run_test_concurrent_finalize",
        status: "completed",
        ended_at: new Date("2026-05-04T20:00:05.000Z"),
      }),
      WorkflowRuns.finalizeWorkflowRun({
        workflow_run_id: "n8n_run_test_concurrent_finalize",
        status: "failed",
        ended_at: new Date("2026-05-04T20:00:10.000Z"),
        error_message: "should not overwrite concurrent winner",
      }),
    ]);
    for (const result of concurrentFinalizes) {
      expect(result.ok).toBe(true);
      if (!result.ok) return;
    }
    const storedConcurrentFinalize =
      await prisma.workflowRun.findUniqueOrThrow({
        where: { workflow_run_id: "n8n_run_test_concurrent_finalize" },
      });
    expect(storedConcurrentFinalize.status).not.toBe("started");
    for (const result of concurrentFinalizes) {
      if (!result.ok) return;
      expect(result.data.status).toBe(storedConcurrentFinalize.status);
      expect(result.data.error_message).toBe(
        storedConcurrentFinalize.error_message ?? undefined,
      );
    }
  });

  test("qa log accessors list ordered by reviewed_at desc and record allows multiple per (call_id, rubric_version)", async () => {
    const list = await QaLogs.listQaLogsByCall({
      accountId: "org_mock_1",
      callId: "call_mock_2",
    });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBe(1);
    expect(list.data[0].id).toBe("qa_mock_1");

    // A second review under the same rubric version is allowed
    // (planning Q10 — latest wins).
    const recorded = await QaLogs.recordQaLog({
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      rubric_version: "v1",
      reviewer_type: "human",
      reviewer_user_id: "user_acme_owner_1",
      score: 92,
      findings_json: { reviewer_note: "test second pass" },
      reviewed_at: new Date("2026-05-05T09:00:00.000Z"),
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;

    const reread = await QaLogs.listQaLogsByCall({
      accountId: "org_mock_1",
      callId: "call_mock_2",
    });
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    expect(reread.data.length).toBe(2);
    // Ordered by reviewed_at desc — the newly recorded human review is first.
    expect(reread.data[0].reviewer_type).toBe("human");
    expect(reread.data[1].reviewer_type).toBe("system");
  });
});
