import { afterAll, beforeEach, describe, expect, test } from "vitest"
import {
  disconnectTestDb,
  prisma,
  resetAndSeedTestDb,
} from "./setup"

describe("Stage B provider enum alignment", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  test("persists Telnyx and Calendly identifiers without live provider behavior", async () => {
    const call = await prisma.call.create({
      data: {
        id: "call_stage_b_telnyx",
        account_id: "org_mock_1",
        contact_id: "contact_mock_1",
        provider: "telnyx",
        provider_call_id: "telnyx-stage-b-call",
        direction: "inbound",
        status: "completed",
        from_number: "+15555550199",
        to_number: "+15555550100",
        started_at: new Date("2026-08-18T14:00:00.000Z"),
        ended_at: new Date("2026-08-18T14:01:00.000Z"),
        duration_seconds: 60,
      },
    })

    const sms = await prisma.smsMessage.create({
      data: {
        id: "sms_stage_b_telnyx",
        account_id: "org_mock_1",
        conversation_id: "conv_mock_1",
        provider: "telnyx",
        provider_message_id: "telnyx-stage-b-message",
        direction: "inbound",
        from_number: "+15555550199",
        to_number: "+15555550100",
        body: "Stage B enum validation only",
        status: "received",
      },
    })

    const appointment = await prisma.appointment.create({
      data: {
        id: "appointment_stage_b_calendly",
        account_id: "org_mock_1",
        contact_id: "contact_mock_1",
        lead_event_id: "lead_mock_2",
        calendar_provider: "calendly",
        external_event_id: "calendly-stage-b-event",
        title: "Stage B enum validation",
        start_time: new Date("2026-08-19T14:00:00.000Z"),
        end_time: new Date("2026-08-19T14:30:00.000Z"),
        status: "scheduled",
      },
    })

    const connections = await prisma.providerConnection.createMany({
      data: [
        {
          id: "pconn_stage_b_telnyx",
          account_id: "org_mock_2",
          provider: "telnyx",
          credentials_encrypted: Buffer.from("<MOCK_REDACTED>"),
          scopes: [],
          connected_by: "user_aj_admin_1",
        },
        {
          id: "pconn_stage_b_calendly",
          account_id: "org_mock_2",
          provider: "calendly",
          credentials_encrypted: Buffer.from("<MOCK_REDACTED>"),
          scopes: [],
          connected_by: "user_aj_admin_1",
        },
      ],
    })

    expect(call.provider).toBe("telnyx")
    expect(sms.provider).toBe("telnyx")
    expect(appointment.calendar_provider).toBe("calendly")
    expect(connections.count).toBe(2)
    const persistedProviders = await prisma.providerConnection.findMany({
        where: { id: { startsWith: "pconn_stage_b_" } },
        select: { provider: true },
      })
    expect(persistedProviders.map(({ provider }) => provider).sort()).toEqual([
      "calendly",
      "telnyx",
    ])
  })
})
