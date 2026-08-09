import { describe, expect, it } from "vitest"

import { resolveProvider } from "@/lib/providers/resolve"

describe("resolveProvider", () => {
  it("returns mock when env var is absent", () => {
    delete process.env.RESPONSEOS_TEST_PROVIDER_KEY
    const result = resolveProvider({
      envVarName: "RESPONSEOS_TEST_PROVIDER_KEY",
      createMock: () => "mock",
      createLive: () => "live",
    })
    expect(result).toBe("mock")
  })

  it("returns mock when env var is set but createLive is omitted", () => {
    process.env.RESPONSEOS_TEST_PROVIDER_KEY = "present"
    try {
      const result = resolveProvider({
        envVarName: "RESPONSEOS_TEST_PROVIDER_KEY",
        createMock: () => "mock",
      })
      expect(result).toBe("mock")
    } finally {
      delete process.env.RESPONSEOS_TEST_PROVIDER_KEY
    }
  })

  it("returns live only when env var is set and createLive is provided", () => {
    process.env.RESPONSEOS_TEST_PROVIDER_KEY = "present"
    try {
      const result = resolveProvider({
        envVarName: "RESPONSEOS_TEST_PROVIDER_KEY",
        createMock: () => "mock",
        createLive: () => "live",
      })
      expect(result).toBe("live")
    } finally {
      delete process.env.RESPONSEOS_TEST_PROVIDER_KEY
    }
  })
})
