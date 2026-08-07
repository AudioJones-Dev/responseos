import { resolveProvider } from "@/lib/providers/resolve"
import { MockSmsProvider } from "@/lib/providers/sms/mock"
import type { SmsProvider } from "@/lib/providers/sms/types"

export * from "@/lib/providers/sms/types"
export * from "@/lib/providers/sms/mock"

export function getSmsProvider(): SmsProvider {
  return resolveProvider({
    envVarName: "TWILIO_ACCOUNT_SID",
    createMock: () => new MockSmsProvider(),
  })
}
