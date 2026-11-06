import type { CallCommand, CallControlAdapter, CaptureAdapter, PlannedRequest, Prompt, TenantCallRoute } from "@/lib/communications/orchestration/contracts";
import { validIndependentRoute } from "@/lib/communications/orchestration/contracts";
import { FRL_GREETING, FRL_CONSENT_PROMPT, FRL_NAME_PROMPT, FRL_TRANSFER_PROMPT, FRL_NO_CONSENT_PROMPT } from "@/lib/communications/consent/mock-intake";

const prompts: Record<Prompt, string> = {
  greeting: FRL_GREETING, consent: FRL_CONSENT_PROMPT, name: FRL_NAME_PROMPT,
  transfer: FRL_TRANSFER_PROMPT, no_consent: FRL_NO_CONSENT_PROMPT,
  unavailable: "We are unable to connect your call. Please try again later.",
};

/** Request descriptions only. No credentials, network transport or capture authorization. */
export class TelnyxCallControlPlanner implements CallControlAdapter, CaptureAdapter {
  confirmCaptureState(): "unknown" { return "unknown"; }

  plan(command: CallCommand, route: TenantCallRoute): PlannedRequest {
    if (route.accountId !== command.accountId) throw new Error("tenant_route_mismatch");
    const body: Record<string, unknown> = { command_id: command.id, client_state: Buffer.from(command.id).toString("base64") };
    let action: string;
    switch (command.kind) {
      case "answer": action = "answer"; break;
      case "hangup": action = "hangup"; break;
      case "speak":
      case "collect_dtmf": {
        if (!command.prompt) throw new Error("missing_prompt");
        Object.assign(body, { payload: prompts[command.prompt], payload_type: "text", voice: "female", language: "en-US", service_level: "basic" });
        action = command.kind === "speak" ? "speak" : "gather_using_speak";
        if (command.kind === "collect_dtmf") Object.assign(body, { minimum_digits: 1, maximum_digits: 1, maximum_tries: 1, timeout_millis: 10000 });
        break;
      }
      case "transfer":
        if (!validIndependentRoute(route, command.accountId)) throw new Error("unsafe_transfer_route");
        action = "transfer";
        Object.assign(body, { to: route.founderDestination, timeout_secs: 20, target_leg_client_state: body.client_state });
        break;
      case "bridge":
        if (!validIndependentRoute(route, command.accountId) || !route.founderCallControlId || route.founderCallControlId === command.callControlId) throw new Error("unsafe_bridge_route");
        action = "bridge";
        Object.assign(body, { call_control_id: route.founderCallControlId, prevent_double_bridge: true });
        break;
      case "start_recording": action = "record_start"; Object.assign(body, { channels: "dual", format: "wav" }); break;
      case "stop_recording": action = "record_stop"; break;
      case "start_transcription": action = "transcription_start"; Object.assign(body, { transcription_tracks: "inbound" }); break;
      case "stop_transcription": action = "transcription_stop"; break;
      case "stop_streaming": action = "streaming_stop"; break;
    }
    return { method: "POST", path: `/v2/calls/${encodeURIComponent(command.callControlId)}/actions/${action}`, body };
  }
}

export function commandAccepted(response: unknown): boolean {
  return !!response && typeof response === "object" && "data" in response &&
    !!response.data && typeof response.data === "object" && "result" in response.data && response.data.result === "ok";
}
