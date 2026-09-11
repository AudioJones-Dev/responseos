import Link from "next/link";
import {
  AlertBanner,
  Card,
  CardHeading,
  PageHeader,
  StatusBadge,
  type Tone,
} from "@/components/ui";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import {
  answerProfessionalQuestion,
  listShareableAssets,
  parseAgentProfilePolicy,
  resolveAgentProfile,
  type ClaimAuthority,
} from "@/lib/professional";
import {
  getProfessionalKnowledgeProvider,
  INTERNAL_DEMO_ACCOUNT_ID,
} from "@/lib/providers/professionalKnowledge";
import { EXAMPLE_QUESTIONS } from "./_data/examples";

/**
 * Read-only entry point for the internal demo tenant's receptionist.
 *
 * The account id is a server-side constant and is never read from the
 * request: a caller supplies the question and nothing else, so no input
 * can steer the answer at another tenant (SECURITY.md).
 *
 * Only the read path is wired. `lib/professional/intake.ts` — opportunity
 * capture, escalation emission, booking — writes rows and is deliberately
 * not reachable from here; an anonymous visitor must not be able to create
 * them. The page therefore shows what the receptionist *would* say,
 * including that a question escalates, without any escalation being
 * emitted.
 */

const AUTHORITY_LABEL: Record<ClaimAuthority, string> = {
  answer: "Answered from a verified record",
  escalate: "Escalated to the account owner",
  refuse: "Refused",
  unavailable: "No verified source",
  tool_lookup: "Deferred to a calendar lookup",
};

const AUTHORITY_TONE: Record<ClaimAuthority, Tone> = {
  answer: "success",
  escalate: "warning",
  refuse: "danger",
  unavailable: "neutral",
  tool_lookup: "accent",
};

export default async function DemoReceptionistPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).q;
  const question = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const profile = await getProfessionalKnowledgeProvider().getProfile(
    INTERNAL_DEMO_ACCOUNT_ID,
  );

  // The account's own default profile decides what may be disclosed —
  // resolved the way the runtime resolves it rather than hardcoded here,
  // so this page cannot drift from the policy the tenant actually has.
  const agentProfile = resolveAgentProfile(getMockAgentProfiles());
  const policy = parseAgentProfilePolicy(agentProfile?.system_policy_json);

  const answer = question
    ? await answerProfessionalQuestion({
        accountId: INTERNAL_DEMO_ACCOUNT_ID,
        question,
        policy,
      })
    : null;

  const assets = await listShareableAssets({
    accountId: INTERNAL_DEMO_ACCOUNT_ID,
    policy,
  });

  return (
    <>
      <PageHeader
        eyebrow="Internal demo tenant"
        title={profile?.headline ?? "Professional receptionist"}
        description={
          profile
            ? `Ask what a recruiter would ask ${profile.ownerName}. Every answer is drawn from a verified record or declined.`
            : "No profile is loaded for this tenant."
        }
      />

      <AlertBanner className="mb-6">
        Read-only. Nothing you type is stored, no opportunity is captured, no
        appointment is booked, and no handoff is emitted — this page reaches
        only the answering path. Knowledge and scheduling both resolve to mock
        adapters; no live provider is wired.
      </AlertBanner>

      <Card className="mb-6">
        <CardHeading>Ask the receptionist</CardHeading>
        <form method="get" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="q" className="sr-only">
            Question
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={question}
            placeholder="What is his business systems experience?"
            className="flex-1 rounded-lg border border-line bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Ask
          </button>
        </form>

        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Try one
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((example) => (
            <li key={example.question}>
              <Link
                href={`/demo/receptionist?q=${encodeURIComponent(example.question)}`}
                className="inline-block rounded-full border border-line px-3 py-1 text-xs text-ink-secondary transition-colors hover:border-line-strong hover:text-ink"
              >
                {example.question}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {answer ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardHeading>Response</CardHeading>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={AUTHORITY_LABEL[answer.authority]}
                tone={AUTHORITY_TONE[answer.authority]}
              />
              <StatusBadge label={answer.category.replaceAll("_", " ")} tone="neutral" />
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink">{answer.message}</p>

          <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-xs sm:grid-cols-3">
            <div>
              <dt className="font-semibold uppercase tracking-widest text-ink-muted">
                Grounded
              </dt>
              <dd className="mt-1 text-ink-secondary">
                {answer.answered
                  ? "Yes — a verified record backed this answer"
                  : "No — nothing verified was spoken"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-widest text-ink-muted">
                Cited records
              </dt>
              <dd className="mt-1 text-ink-secondary">
                {answer.sources.length > 0 ? answer.sources.join(", ") : "None"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-widest text-ink-muted">
                Owner follow-up
              </dt>
              <dd className="mt-1 text-ink-secondary">
                {answer.escalated
                  ? "This question is the owner's to answer"
                  : "Not required"}
              </dd>
            </div>
          </dl>

          {answer.escalated ? (
            <p className="mt-4 text-xs text-ink-muted">
              In a wired deployment this is where the escalation event would be
              emitted. This page does not emit it.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeading>Assets this profile may share</CardHeading>
        <p className="mt-2 text-xs text-ink-muted">
          Filtered by the answering profile&rsquo;s policy. A link reaches a
          caller only through this list — no answer body carries one.
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {assets.map((asset) => (
            <li key={asset.id} className="flex items-center gap-2">
              <StatusBadge label={asset.type.replaceAll("_", " ")} tone="neutral" />
              <a
                href={asset.url}
                rel="noreferrer noopener"
                target="_blank"
                className="text-ink-secondary underline underline-offset-2 transition-colors hover:text-ink"
              >
                {asset.label}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
