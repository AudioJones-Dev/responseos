import "@/lib/serverOnlyGuard";

export const CALL_CONTROL_EVENT_TYPES = [
  "call.initiated",
  "call.answered",
  "call.speak.ended",
  "call.gather.ended",
  "call.bridged",
  "call.hangup",
  "call.ai_gather.message_history_updated",
  "call.conversation.ended",
] as const;

export type CallControlEventType = (typeof CALL_CONTROL_EVENT_TYPES)[number];

export interface CallControlEvent {
  data: {
    id: string;
    event_type: CallControlEventType;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_session_id: string;
      call_leg_id?: string;
      conversation_id?: string;
      connection_id?: string;
      client_state?: string;
      from?: string;
      to?: string;
      digits?: string;
      status?: string;
      message_history?: Array<{ role: string; content: string }>;
      hangup_cause?: string;
    };
  };
}

export function parseCallControlEvent(rawBody: string): CallControlEvent | null {
  try {
    const value = JSON.parse(rawBody) as Record<string, unknown>;
    const data = value.data as Record<string, unknown> | undefined;
    const payload = data?.payload as Record<string, unknown> | undefined;
    if (!data || !payload || !CALL_CONTROL_EVENT_TYPES.includes(data.event_type as CallControlEventType)) return null;
    if (typeof data.id !== "string" || typeof data.occurred_at !== "string") return null;
    if (Number.isNaN(new Date(data.occurred_at).getTime())) return null;
    if (typeof payload.call_control_id !== "string" || typeof payload.call_session_id !== "string") return null;
    if (data.event_type === "call.initiated" && typeof payload.to !== "string") return null;
    if (data.event_type === "call.gather.ended" && (typeof payload.status !== "string" || (payload.digits !== undefined && typeof payload.digits !== "string"))) return null;
    if (data.event_type === "call.ai_gather.message_history_updated") {
      if (!Array.isArray(payload.message_history) || !payload.message_history.every((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).role === "string" && typeof (item as Record<string, unknown>).content === "string")) return null;
    } else if (payload.message_history !== undefined) return null;
    const text = (key: string) => typeof payload[key] === "string" ? payload[key] as string : undefined;
    return {
      data: {
        id: data.id,
        event_type: data.event_type as CallControlEventType,
        occurred_at: data.occurred_at,
        payload: {
          call_control_id: payload.call_control_id as string,
          call_session_id: payload.call_session_id as string,
          ...(text("call_leg_id") ? { call_leg_id: text("call_leg_id") } : {}),
          ...(text("conversation_id") ? { conversation_id: text("conversation_id") } : {}),
          ...(text("connection_id") ? { connection_id: text("connection_id") } : {}),
          ...(text("client_state") ? { client_state: text("client_state") } : {}),
          ...(text("from") ? { from: text("from") } : {}),
          ...(text("to") ? { to: text("to") } : {}),
          ...(text("digits") ? { digits: text("digits") } : {}),
          ...(text("status") ? { status: text("status") } : {}),
          ...(text("hangup_cause") ? { hangup_cause: text("hangup_cause") } : {}),
          ...(Array.isArray(payload.message_history) ? { message_history: payload.message_history.map((item) => ({ role: (item as Record<string, unknown>).role as string, content: (item as Record<string, unknown>).content as string })) } : {}),
        },
      },
    };
  } catch {
    return null;
  }
}

export type TelnyxCommandAction = "answer" | "speak" | "gather_using_speak" | "ai_assistant_start" | "ai_assistant_stop" | "transfer" | "hangup";

export interface TelnyxCommandResult {
  status: number;
  providerDate: Date | null;
  conversationId: string | null;
  ok: boolean;
  errorCode: string | null;
}

export async function sendTelnyxCallCommand(params: {
  callControlId: string;
  action: TelnyxCommandAction;
  body: Record<string, unknown>;
}): Promise<TelnyxCommandResult> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true") {
    return { status: 0, providerDate: null, conversationId: null, ok: false, errorCode: "telnyx_control_disabled" };
  }
  try {
    const response = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(params.callControlId)}/actions/${params.action}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(params.body),
      cache: "no-store",
    });
    const value = await response.json().catch(() => null) as { data?: { conversation_id?: unknown }; errors?: Array<{ code?: unknown }> } | null;
    const date = response.headers.get("date");
    const providerDate = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date) : null;
    const conversationId = typeof value?.data?.conversation_id === "string" ? value.data.conversation_id : null;
    const errorCode = response.ok ? null : typeof value?.errors?.[0]?.code === "string" ? value.errors[0].code : `telnyx_http_${response.status}`;
    return { status: response.status, providerDate, conversationId, ok: response.ok, errorCode };
  } catch {
    return { status: 0, providerDate: null, conversationId: null, ok: false, errorCode: "telnyx_response_uncertain" };
  }
}
