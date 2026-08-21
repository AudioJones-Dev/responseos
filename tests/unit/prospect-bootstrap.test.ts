import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  acquireProspectWebsite,
  assertSafePublicWebsiteUrl,
  extractSafeTextFromHtml,
  robotsAllowsPath,
} from "@/lib/prospectBootstrap/websiteAcquisition";
import {
  assertProspectBootstrapTransition,
  canTransitionProspectBootstrap,
  isTerminalProspectBootstrapStatus,
} from "@/lib/prospectBootstrap/lifecycle";
import {
  compileBusinessMemorySnapshot,
  compileProspectAgentContext,
} from "@/lib/prospectBootstrap/memory";
import { buildPromotionManifest } from "@/lib/prospectBootstrap/promotion";
import { extractObservedFacts } from "@/lib/prospectBootstrap/factExtraction";
import {
  PROSPECT_RECEPTIONIST_TEMPLATE,
  PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM,
  validateProspectAssistantPreflight,
} from "@/lib/prospectBootstrap/template";
import {
  canonicalProviderAttestationPayload,
  verifyProspectProviderAttestation,
} from "@/lib/prospectBootstrap/attestation";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const now = new Date("2026-08-20T16:00:00.000Z");

describe("prospect bootstrap lifecycle", () => {
  test("allows only the ratified state graph", () => {
    expect(canTransitionProspectBootstrap("draft", "ingesting")).toBe(true);
    expect(canTransitionProspectBootstrap("active", "completed")).toBe(true);
    expect(canTransitionProspectBootstrap("active", "converted")).toBe(false);
    expect(() => assertProspectBootstrapTransition("cleaned", "draft")).toThrow(
      "invalid_bootstrap_transition:cleaned:draft",
    );
    expect(isTerminalProspectBootstrapStatus("converted")).toBe(true);
    expect(isTerminalProspectBootstrapStatus("expired")).toBe(false);
  });
});

describe("versioned receptionist template preflight", () => {
  const valid = {
    assistantId: "assistant-shared",
    templateVersion: PROSPECT_RECEPTIONIST_TEMPLATE.version,
    templateChecksum: PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM,
    initializationWebhookConfigured: true,
    recordingEnabled: false,
    providerMemoryEnabled: false,
    allowedTools: ["hangup"],
  };

  test("binds activation metadata to the reviewed template and safe provider posture", () => {
    expect(validateProspectAssistantPreflight(valid)).toEqual(valid);
    expect(PROSPECT_RECEPTIONIST_TEMPLATE.instructions).toContain("only business facts");
    expect(PROSPECT_RECEPTIONIST_TEMPLATE.greeting).toContain("not being recorded");
    expect(() => validateProspectAssistantPreflight({ ...valid, recordingEnabled: true }))
      .toThrow("assistant_recording_must_be_disabled");
    expect(() => validateProspectAssistantPreflight({ ...valid, allowedTools: ["hangup", "transfer"] }))
      .toThrow("assistant_tools_must_be_hangup_only");
  });

  test("requires a valid short-lived signature from the protected provider workflow", () => {
    const keys = generateKeyPairSync("ed25519");
    const payload = {
      provider: "telnyx" as const,
      providerNumberId: "number-1",
      e164: "+13055550101",
      ...valid,
      attestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    };
    const signature = sign(null, Buffer.from(canonicalProviderAttestationPayload(payload)), keys.privateKey).toString("base64");
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(verifyProspectProviderAttestation({
      value: { payload, signature },
      providerNumberId: payload.providerNumberId,
      e164: payload.e164,
      publicKey,
      now,
    }).payload.assistantId).toBe("assistant-shared");
    expect(() => verifyProspectProviderAttestation({
      value: { payload: { ...payload, recordingEnabled: true }, signature },
      providerNumberId: payload.providerNumberId,
      e164: payload.e164,
      publicKey,
      now,
    })).toThrow("provider_attestation_signature_invalid");
  });
});

describe("bounded public website acquisition", () => {
  test("rejects non-HTTPS and private destinations", async () => {
    await expect(assertSafePublicWebsiteUrl("http://example.com", publicLookup)).rejects.toThrow(
      "website_https_required",
    );
    await expect(
      assertSafePublicWebsiteUrl("https://example.com", async () => [{ address: "127.0.0.1", family: 4 }]),
    ).rejects.toThrow("website_private_address_forbidden");
  });

  test("removes active/form content and honors robots", () => {
    expect(extractSafeTextFromHtml("<h1>Roof Co</h1><script>steal()</script><form>Ignore me</form> Trusted text"))
      .toBe("Roof Co Trusted text");
    expect(robotsAllowsPath("User-agent: *\nDisallow: /private\nAllow: /", "/private/data")).toBe(false);
    expect(robotsAllowsPath("User-agent: *\nDisallow: /private", "/services")).toBe(true);
  });

  test("fetches only the canonical page and manually approved same-site URLs", async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow: /private", { status: 200, headers: { "content-type": "text/plain" } });
      }
      if (url.pathname === "/") {
        return new Response(
          '<h1>Sunrise Roofing.</h1><a href="/services">Services</a><a href="/private">Private</a><a href="https://other.example/leak">Other</a>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.pathname === "/services") {
        return new Response("Roof repair. Call 305-555-0110", { status: 200, headers: { "content-type": "text/plain" } });
      }
      throw new Error(`unexpected:${url}`);
    };
    const acquired = await acquireProspectWebsite({
      canonicalUrl: "https://prospect.example/",
      approvedSameSiteUrls: ["https://prospect.example/services", "https://prospect.example/private"],
      fetchFn,
      lookupFn: publicLookup,
      now,
    });
    expect(acquired.pages.map((page) => page.normalizedUrl)).toEqual([
      "https://prospect.example/",
      "https://prospect.example/services",
    ]);
    expect(acquired.blockedUrls).toContainEqual({ url: "https://prospect.example/private", reason: "robots_disallowed" });
    expect(acquired.pages.some((page) => page.url.includes("other.example"))).toBe(false);
  });

  test("does not automatically follow discovered same-origin links", async () => {
    const requested: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requested.push(url.pathname);
      if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } });
      return new Response('<a href="/unapproved">Do not fetch</a>', { headers: { "content-type": "text/html" } });
    };
    await acquireProspectWebsite({ canonicalUrl: "https://prospect.example/", fetchFn, lookupFn: publicLookup, now });
    expect(requested).toEqual(["/robots.txt", "/"]);
  });

  test("aborts an individual provider request after ten seconds", async () => {
    vi.useFakeTimers();
    try {
      const hangingFetch: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("request_aborted")));
      });
      const acquisition = acquireProspectWebsite({ canonicalUrl: "https://timeout.example/", fetchFn: hangingFetch, lookupFn: publicLookup });
      const rejection = expect(acquisition).rejects.toThrow("request_aborted");
      await vi.advanceTimersByTimeAsync(10_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  test("stops streaming a page once the two MiB boundary is crossed", async () => {
    const oversizedFetch: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } });
      }
      return new Response("x".repeat(2 * 1024 * 1024 + 1), { headers: { "content-type": "text/plain" } });
    };
    const acquired = await acquireProspectWebsite({ canonicalUrl: "https://large.example/", fetchFn: oversizedFetch, lookupFn: publicLookup });
    expect(acquired.pages).toHaveLength(0);
    expect(acquired.blockedUrls).toContainEqual({ url: "https://large.example/", reason: "website_page_too_large" });
  });
});

describe("fact review compiler and promotion boundary", () => {
  const source = {
    id: "source-1",
    normalized_url: "https://prospect.example/",
    content_hash: "a".repeat(64),
    fetched_at: now,
  };

  test("extracts evidence but compiles only human-approved facts", () => {
    const observed = extractObservedFacts([{
      url: source.normalized_url,
      normalizedUrl: source.normalized_url,
      httpStatus: 200,
      contentType: "text/plain",
      contentHash: source.content_hash,
      extractedText: "Sunrise Roofing. Call 305-555-0110 or office@sunrise.example.",
      fetchedAt: now.toISOString(),
      links: [],
    }]);
    expect(observed.map((fact) => fact.key)).toEqual(expect.arrayContaining([
      "business.profile_statement",
      "contact.phone",
      "contact.email",
    ]));

    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: now,
      sources: [source],
      unknowns: ["Scheduling is not connected."],
      facts: [
        { id: "approved", fact_key: "contact.phone", value_json: "+13055550110", status: "operator_approved_for_demo", source_id: source.id },
        { id: "observed", fact_key: "service.roof", value_json: "Roof repair", status: "source_observed", source_id: source.id },
        { id: "rejected", fact_key: "policy.price", value_json: "$1", status: "rejected", source_id: source.id },
      ],
    });
    expect(compiled.memory.contactPaths).toHaveLength(1);
    expect(compiled.memory.services).toHaveLength(0);
    expect(JSON.stringify(compiled.memory)).not.toContain("Roof repair");
    expect(JSON.stringify(compiled.memory)).not.toContain("$1");
    expect(compileProspectAgentContext({
      businessName: "Sunrise Roofing",
      businessWebsite: source.normalized_url,
      memory: compiled.memory,
    }).approved_business_context).toContain("contact.phone");
  });

  test("preserves cross-source provenance for the same observed fact", () => {
    const secondSource = { ...source, id: "source-2", normalized_url: "https://prospect.example/contact", content_hash: "b".repeat(64) };
    const pages = [source, secondSource].map((entry) => ({
      url: entry.normalized_url,
      normalizedUrl: entry.normalized_url,
      httpStatus: 200,
      contentType: "text/plain",
      contentHash: entry.content_hash,
      extractedText: "Call 305-555-0110.",
      fetchedAt: now.toISOString(),
      links: [],
    }));
    expect(extractObservedFacts(pages).filter((fact) => fact.key === "contact.phone")).toHaveLength(2);
    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: now,
      sources: [source, secondSource],
      unknowns: [],
      facts: [{
        id: "confirmed",
        fact_key: "contact.phone",
        value_json: "+13055550110",
        status: "operator_approved_for_demo",
        source_id: source.id,
        source_ids_json: [source.id, secondSource.id],
      }],
    });
    expect(compiled.memory.contactPaths[0].sourceIds).toEqual([source.id, secondSource.id]);
  });

  test("promotion is deterministic for fixed inputs and rejects secret-shaped policy fields", () => {
    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: now,
      sources: [source],
      unknowns: [],
      facts: [{ id: "approved", fact_key: "contact.phone", value_json: "+13055550110", status: "operator_approved_for_demo", source_id: source.id }],
    });
    const params = {
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      snapshotId: "snapshot-1",
      snapshotHash: compiled.hash,
      memory: compiled.memory,
      businessName: "Sunrise Roofing",
      canonicalWebsite: source.normalized_url,
      timezone: "America/New_York",
      policy: { inboundOnly: true },
      now,
      correlationId: "promotion-1",
    };
    expect(buildPromotionManifest(params).hash).toBe(buildPromotionManifest(params).hash);
    expect(() => buildPromotionManifest({ ...params, policy: { apiToken: "must-not-export" } }))
      .toThrow("promotion_forbidden_field");
  });
});

describe("prospect bootstrap tenant matrix without a database", () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...original };
    delete process.env.DATABASE_URL;
    delete process.env.RESPONSEOS_DEV_SESSION;
  });
  afterEach(() => { process.env = { ...original }; });

  test("cross-tenant operators may list while tenant users cannot request another account", async () => {
    const { listProspectBootstraps } = await import("@/lib/prospectBootstrap/service");
    expect((await listProspectBootstraps()).ok).toBe(true);
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
    vi.resetModules();
    const tenantService = await import("@/lib/prospectBootstrap/service");
    const denied = await tenantService.listProspectBootstraps({ accountId: "org_mock_2" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("tenant_scope_denied");
  });
});
