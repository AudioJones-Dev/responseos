import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { assertGrokQualified, grokSelected, verifyIncomingSip, terminateGrokCall } from "@/lib/grok/provider";
import { GrokCallControls } from "@/app/(admin)/admin/demo-operations/GrokCallControls";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllEnvs());
test("environment and credentials cannot enable an unqualified Grok provider", async () => {
  vi.stubEnv("RESPONSEOS_VOICE_ENGINE", "grok-voice-3.0");
  vi.stubEnv("RESPONSEOS_LIVE_GROK_ENABLED", "true");
  expect(grokSelected()).toBe(true);
  expect(() => assertGrokQualified()).toThrow("unqualified");
  await expect(verifyIncomingSip("{}", new Headers())).rejects.toThrow("unqualified");
  expect(await terminateGrokCall("xai", "fixture", "fixture-command")).toBe("disabled");
});
test("unknown voice engine fails closed", () => {
  vi.stubEnv("RESPONSEOS_VOICE_ENGINE", "grok-voice-latest");
  expect(() => grokSelected()).toThrow("unknown_voice_engine");
});
test("Grok console never equates acceptance or closed admission with disconnection", () => {
  const html = renderToStaticMarkup(createElement(GrokCallControls, { captureId: "capture", accountId: "account", providerCallId: "exact-call", generation: 2, stopped: true, commands: [{ kind: "xai_hangup", status: "accepted" }] }));
  expect(html).toContain("Disconnection unconfirmed");
  expect(html).toContain("consent cannot reopen");
  expect(html).toContain("exact-call");
  expect(html).toContain("End Grok call");
});
