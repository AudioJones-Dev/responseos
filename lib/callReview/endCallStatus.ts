import type { Prisma } from "@prisma/client";

type Command = { id: string; account_id: string; capture_session_id: string; assignment_id: string; provider_resource: string; command_id: string; generation: number; status: string; provider_response_status: number | null };
type OriginAudit = { action: string; actor_type: string; actor_user_id: string | null; metadata_json: Prisma.JsonValue | null };
export type EndCallAttemptStatus = { generation: number; origin: "operator" | "system" | "unknown"; authorizationRecorded: boolean; message: string };

export function endCallAttemptStatus(command: Command, audits: OriginAudit[]): EndCallAttemptStatus {
  const metadata = (audit: OriginAudit) => audit.metadata_json && typeof audit.metadata_json === "object" && !Array.isArray(audit.metadata_json) ? audit.metadata_json : {};
  const requested = audits.filter(audit => audit.action === "call_end_requested" && metadata(audit).commandId === command.command_id && metadata(audit).generation === command.generation);
  const operator = requested.length === 1 && requested[0].actor_type === "user" && Boolean(requested[0].actor_user_id);
  const system = requested.length === 1 && requested[0].actor_type === "system" && !requested[0].actor_user_id;
  const origin = operator ? "operator" : system ? "system" : "unknown";
  const authorizationRecorded = operator && audits.some(audit => {
    const value = metadata(audit);
    return audit.action === "call_end_authorized" && audit.actor_type === "user" && audit.actor_user_id === requested[0].actor_user_id &&
      value.authority === "one_shot_after_commit" && value.commandId === command.command_id && value.commandRowId === command.id &&
      value.accountId === command.account_id && value.captureId === command.capture_session_id && value.assignmentId === command.assignment_id &&
      value.callControlId === command.provider_resource && value.generation === command.generation;
  });
  const phase = origin === "system" ? "Automatic/system attempt reserved; it may already have sent." : origin === "unknown" ? "Attempt origin unknown; it may already have sent." : authorizationRecorded ? "Operator send authorization recorded; delivery is not proved by authorization." : "Operator attempt reserved; send authorization not recorded. The original request may still progress; this does not prove it was unsent.";
  const response = command.provider_response_status !== null && command.provider_response_status > 0 ? ` Command response recorded: ${command.status} (HTTP ${command.provider_response_status}).` : ` Command status: ${command.status}; response not recorded.`;
  return { generation: command.generation, origin, authorizationRecorded, message: `${phase}${response} No retry. Command acceptance is not confirmed disconnection.` };
}