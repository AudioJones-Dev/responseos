import { createHash } from "node:crypto";
import type { QualifiedEmailProvider, QualifiedEmailRequest } from "./types";

export class MockQualifiedEmailProvider implements QualifiedEmailProvider {
  readonly providerId = "mock" as const;
  async send(request: QualifiedEmailRequest) {
    return { messageId: `mock-${createHash("sha256").update(request.idempotencyKey).digest("hex")}`, event: "accepted" as const };
  }
  async inspect(messageId: string) {
    return { messageId, event: "delivered" as const };
  }
}
