import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { recordAuditLog } from "@/lib/data/auditLogs";
import { err, ok, type Result } from "@/lib/data/result";

/**
 * Clerk webhook reconciliation (32C, Path A in the alignment plan §4.8).
 *
 * The signature is verified by the route handler before this runs (ADR-0009).
 * This module performs the idempotent, replay-safe sync of Clerk identity and
 * organization state into the existing `User` / `Account` rows.
 *
 * Conservative posture (operator Q4 / Q6, carried over from 32B):
 * - New users are created at the lowest privilege (`client_viewer`). Roles are
 *   NEVER auto-elevated from generic Clerk org membership — `client_admin`
 *   stays an explicit DB/operator grant.
 * - Membership events set the tenant binding (`User.account_id`) that the 32B
 *   session derivation checks; removal clears it and resets to `client_viewer`.
 *   This is the authoritative source for the PR #40 tenant-isolation guard.
 * - This is org-membership-driven provisioning via signed webhooks, NOT
 *   just-in-time provisioning during session derivation (session.ts is
 *   unchanged and still creates nothing).
 */

const NEW_ACCOUNT_DEFAULTS = {
  industry: "unspecified",
  timezone: "America/New_York",
  status: "lead" as const,
};

type ClerkEvent = { type: string; data: Record<string, unknown> };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractEmail(data: Record<string, unknown>): string | undefined {
  const primaryId = asString(data.primary_email_address_id);
  const list = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const entries = list.filter(
    (e): e is Record<string, unknown> => typeof e === "object" && e !== null,
  );
  const primary = entries.find((e) => asString(e.id) === primaryId) ?? entries[0];
  return primary ? asString(primary.email_address) : undefined;
}

function extractName(data: Record<string, unknown>): string | undefined {
  const parts = [asString(data.first_name), asString(data.last_name)].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

async function upsertUser(data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  const clerkUserId = asString(data.id);
  if (!clerkUserId) return;

  const email = extractEmail(data);
  const name = extractName(data);
  const existing = await db.user.findUnique({
    where: { clerk_user_id: clerkUserId },
  });

  if (existing) {
    await db.user.update({
      where: { clerk_user_id: clerkUserId },
      data: {
        ...(email ? { email } : {}),
        ...(name ? { name } : {}),
      },
    });
    return;
  }

  // Cannot create without an email (unique, required). Never link an existing
  // unlinked row by email — that would be an account-takeover vector.
  if (!email) return;
  await db.user.create({
    data: {
      clerk_user_id: clerkUserId,
      email,
      name: name ?? email,
      role: "client_viewer",
    },
  });
}

async function detachDeletedUser(data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  const clerkUserId = asString(data.id);
  if (!clerkUserId) return;

  const existing = await db.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true, account_id: true },
  });
  if (!existing) return;

  // Operator Q5: keep the row for history, null out the Clerk link so it can no
  // longer sign in, and write a security audit record.
  await db.user.update({
    where: { clerk_user_id: clerkUserId },
    data: { clerk_user_id: null },
  });
  await recordAuditLog({
    account_id: existing.account_id ?? undefined,
    actor_type: "webhook",
    action: "clerk.user.deleted",
    category: "security",
    target_type: "user",
    target_id: existing.id,
    reason: "Clerk user.deleted webhook — unlinked clerk_user_id.",
  });
}

async function upsertAccount(data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  const clerkOrgId = asString(data.id);
  if (!clerkOrgId) return;

  const name = asString(data.name);
  const slug = asString(data.slug) ?? clerkOrgId;
  const existing = await db.account.findUnique({
    where: { clerk_org_id: clerkOrgId },
  });

  if (existing) {
    await db.account.update({
      where: { clerk_org_id: clerkOrgId },
      data: {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
      },
    });
    return;
  }

  await db.account.create({
    data: {
      clerk_org_id: clerkOrgId,
      name: name ?? slug,
      slug,
      ...NEW_ACCOUNT_DEFAULTS,
    },
  });
}

function extractMembership(data: Record<string, unknown>): {
  clerkUserId?: string;
  clerkOrgId?: string;
} {
  const org =
    typeof data.organization === "object" && data.organization !== null
      ? (data.organization as Record<string, unknown>)
      : {};
  const publicUserData =
    typeof data.public_user_data === "object" && data.public_user_data !== null
      ? (data.public_user_data as Record<string, unknown>)
      : {};
  return {
    clerkUserId: asString(publicUserData.user_id),
    clerkOrgId: asString(org.id),
  };
}

async function syncMembership(data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  const { clerkUserId, clerkOrgId } = extractMembership(data);
  if (!clerkUserId || !clerkOrgId) return;

  const account = await db.account.findUnique({
    where: { clerk_org_id: clerkOrgId },
    select: { id: true },
  });
  // Fail closed: do not bind a user to an org we have not synced yet. The next
  // membership event (or organization.created) reconciles.
  if (!account) return;

  // Bind the user to their tenant (the 32B isolation check reads account_id).
  // Role is intentionally left untouched — never auto-elevated from generic
  // Clerk membership (operator Q4).
  await db.user.updateMany({
    where: { clerk_user_id: clerkUserId },
    data: { account_id: account.id },
  });
}

async function detachMembership(data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  const { clerkUserId } = extractMembership(data);
  if (!clerkUserId) return;

  // Operator Q6 safe default: detach from the tenant and drop to the lowest
  // role so a removed member cannot retain elevated access.
  await db.user.updateMany({
    where: { clerk_user_id: clerkUserId },
    data: { account_id: null, role: "client_viewer" },
  });
}

async function dispatch(event: ClerkEvent): Promise<void> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await upsertUser(event.data);
      break;
    case "user.deleted":
      await detachDeletedUser(event.data);
      break;
    case "organization.created":
    case "organization.updated":
      await upsertAccount(event.data);
      break;
    case "organizationMembership.created":
    case "organizationMembership.updated":
      await syncMembership(event.data);
      break;
    case "organizationMembership.deleted":
      await detachMembership(event.data);
      break;
    default:
      // Unhandled event types are acknowledged but not acted on.
      break;
  }
}

export type ClerkSyncStatus = "processed" | "duplicate";

/**
 * Records the (signature-verified) Clerk event in the webhook ledger for
 * replay-safety, then performs the idempotent reconciliation. Replays are
 * detected by Clerk's event id and short-circuit as `duplicate`.
 */
export async function handleClerkEvent(params: {
  event: ClerkEvent;
  eventId: string;
  rawBody: string;
}): Promise<Result<{ status: ClerkSyncStatus }>> {
  if (!db) {
    return err("no_database", "Clerk webhook sync requires DATABASE_URL.");
  }

  const ledger = await recordWebhookEvent({
    provider: "clerk",
    provider_event_id: params.eventId,
    event_type: params.event.type,
    raw_body: params.rawBody,
    signature_valid: true,
  });
  if (!ledger.ok) {
    return ledger;
  }
  if (ledger.data.process_status === "duplicate") {
    return ok({ status: "duplicate" });
  }

  try {
    await dispatch(params.event);
    await db.webhookEvent.update({
      where: { id: ledger.data.id },
      data: { process_status: "processed", processed_at: new Date() },
    });
    return ok({ status: "processed" });
  } catch (e) {
    await db.webhookEvent.update({
      where: { id: ledger.data.id },
      data: {
        process_status: "error",
        process_error: e instanceof Error ? e.message : String(e),
      },
    });
    return err("sync_failed", "Clerk webhook reconciliation failed.");
  }
}
