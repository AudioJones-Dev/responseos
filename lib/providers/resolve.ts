/**
 * Provider resolver — always returns mock adapters when live env vars are
 * absent (ADR-0001). This slice never constructs live SDK clients.
 */

import { MockCarrierProvider } from "@/lib/providers/carrier";
import type { CarrierProvider } from "@/lib/providers/carrier";
import { MockCrmProvider } from "@/lib/providers/crm";
import type { CrmProvider } from "@/lib/providers/crm";
import { MockSchedulingProvider } from "@/lib/providers/scheduling";
import type { SchedulingProvider } from "@/lib/providers/scheduling";
import { MockSmsProvider } from "@/lib/providers/sms";
import type { SmsProvider } from "@/lib/providers/sms";
import { MockVoiceAgentProvider } from "@/lib/providers/voiceAgent";
import type { VoiceAgentProvider } from "@/lib/providers/voiceAgent";

export function resolveCarrierProvider(): CarrierProvider {
  // Live Telnyx/Twilio adapters are Gate Set B — always mock in this slice.
  return new MockCarrierProvider();
}

export function resolveVoiceAgentProvider(): VoiceAgentProvider {
  return new MockVoiceAgentProvider();
}

export function resolveSmsProvider(): SmsProvider {
  return new MockSmsProvider();
}

export function resolveCrmProvider(): CrmProvider {
  return new MockCrmProvider();
}

export function resolveSchedulingProvider(): SchedulingProvider {
  return new MockSchedulingProvider();
}
