import { describe, expect, test } from "vitest";
import {
  extractTelnyxCallInsight,
  extractTelnyxTranscript,
} from "@/lib/providers/telnyx/insights";

/**
 * The documented insight event carries `results[].result` as a STRING, JSON
 * when the insight template declares a schema. These fixtures follow the
 * documented shape; the legacy fixtures follow the undocumented one the demo
 * lane already depends on.
 */
describe("Telnyx conversation insight extraction", () => {
  test("parses a JSON-encoded structured result and ignores insight ids", () => {
    const insight = extractTelnyxCallInsight({
      call_control_id: "call-1",
      results: [
        { insight_id: "any-id-at-all", result: "The caller asked about a ramp installation." },
        {
          insight_id: "another-id",
          result: JSON.stringify({
            caller: { first_name: "Dana", last_name: "Rivera", city: "Example City", postal_code: "00000" },
            caller_relationship: "NEW_PROSPECT",
            interaction_class: "NEW_SALES",
            service_requested: "Modular ramp",
            quote_requested: true,
            photos_requested: true,
            next_action: "Call back to confirm the site measurements.",
            recording_consent: "continued",
            qualification: { status: "qualified", score: 88 },
          }),
        },
      ],
    });
    expect(insight).toMatchObject({
      firstName: "Dana",
      lastName: "Rivera",
      city: "Example City",
      postalCode: "00000",
      callerRelationship: "new_prospect",
      interactionClass: "new_sales",
      serviceRequested: "Modular ramp",
      quoteRequested: true,
      photosRequested: true,
      recordingConsent: "continued",
    });
    expect(insight.summary).toBe("The caller asked about a ramp installation.");
    expect(insight.qualification).toMatchObject({ status: "qualified", score: 88 });
  });

  test("keeps an unrecognised classification out of the record instead of guessing", () => {
    const insight = extractTelnyxCallInsight({
      results: [{ insight_id: "i", result: JSON.stringify({ interaction_class: "BILLING_DISPUTE", caller_relationship: "friend" }) }],
    });
    expect(insight.interactionClass).toBeNull();
    expect(insight.callerRelationship).toBeNull();
  });

  test("treats a non-JSON result as the summary and never throws on malformed JSON", () => {
    expect(extractTelnyxCallInsight({ results: [{ result: "{not json" }] }).summary).toBe("{not json");
    expect(extractTelnyxCallInsight({ results: "nonsense" }).summary).toBeNull();
    expect(extractTelnyxCallInsight({}).quoteRequested).toBe(false);
  });

  test("still reads the undocumented shape the legacy demo lane sends", () => {
    const insight = extractTelnyxCallInsight({
      summary: "Caller requested a callback.",
      qualification: { status: "qualified", service_needed: "Operations assessment", next_action: "Human callback" },
    });
    expect(insight.summary).toBe("Caller requested a callback.");
    expect(insight.serviceRequested).toBe("Operations assessment");
    expect(insight.nextAction).toBe("Human callback");
  });

  test("requires an explicit true before a quote or photo request is recorded", () => {
    const insight = extractTelnyxCallInsight({
      results: [{ result: JSON.stringify({ quote_requested: "maybe", photos_requested: null }) }],
    });
    expect(insight.quoteRequested).toBe(false);
    expect(insight.photosRequested).toBe(false);
  });
});

describe("Telnyx transcript extraction", () => {
  test("builds transcript text from pushed message history", () => {
    const transcript = extractTelnyxTranscript({
      message_history: [
        { role: "assistant", content: "Thanks for calling." },
        { role: "user", content: "I need a ramp quote." },
      ],
    });
    expect(transcript).toEqual({
      text: "assistant: Thanks for calling.\nuser: I need a ramp quote.",
      turns: 2,
    });
  });

  test("reads the legacy transcript array and a plain string", () => {
    expect(extractTelnyxTranscript({ transcript: [{ role: "caller", content: "Hello" }] })?.text).toBe("caller: Hello");
    expect(extractTelnyxTranscript({ transcript: "caller: Hello" })?.turns).toBe(1);
  });

  test("returns null when the event carries no conversation content", () => {
    expect(extractTelnyxTranscript({ results: [] })).toBeNull();
    expect(extractTelnyxTranscript({ message_history: [{ role: "user" }] })).toBeNull();
  });
});
