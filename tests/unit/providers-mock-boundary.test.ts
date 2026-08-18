import { afterEach, describe, expect, it } from "vitest"

import { getCarrierProvider } from "@/lib/providers/carrier"
import { getCrmProvider } from "@/lib/providers/crm"
import { getSchedulingProvider } from "@/lib/providers/scheduling"
import { getSmsProvider } from "@/lib/providers/sms"
import { getVoiceAgentProvider } from "@/lib/providers/voiceAgent"

const CONFIGURED_PROVIDER_KEYS = [
  "TELNYX_API_KEY",
  "VAPI_API_KEY",
  "HUBSPOT_ACCESS_TOKEN",
  "CALENDLY_API_KEY",
] as const

afterEach(() => {
  for (const key of CONFIGURED_PROVIDER_KEYS) {
    delete process.env[key]
  }
})

describe("Stage B mock-only provider boundary", () => {
  it("keeps every CAL factory on mock even when provider keys are declared", () => {
    for (const key of CONFIGURED_PROVIDER_KEYS) {
      process.env[key] = "stage-b-placeholder"
    }

    expect(getCarrierProvider().providerId).toBe("mock")
    expect(getSmsProvider().providerId).toBe("mock")
    expect(getVoiceAgentProvider().providerId).toBe("mock")
    expect(getCrmProvider().providerId).toBe("mock")
    expect(getSchedulingProvider().providerId).toBe("mock")
  })
})
