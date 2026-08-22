import { describe, expect, test, vi } from "vitest";

import { READABLE_STAGING_NAMES, fetchReadableStagingEnvironment } from "@/scripts/fetch-staging-vercel-readable-env.mjs";

const teamId = "team_BHxIkAGPW6qEKKQBAt9c0NGz";
const projectId = "prj_pbzqdkzp322jcHWIsi19GhsnWXRm";
const projectName = "responseos-staging-mock";
const customId = "env_uX6Qp8F6w9aBgx2ikH3BiREB8aHH";
const readable = READABLE_STAGING_NAMES.final.map((key, index) => ({
  key, id: `readable-${index}`, target: [], customEnvironmentIds: [customId], type: "encrypted", gitBranch: null,
}));
const sensitive = ["DATABASE_URL", "DIRECT_URL", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SECRET"].map((key, index) => ({
  key, id: `sensitive-${index}`, target: [], customEnvironmentIds: [customId], type: "sensitive", gitBranch: null,
}));
const fetcher = () => vi.fn(async (input: URL | RequestInfo) => {
  const id = new URL(String(input)).pathname.split("/").at(-1);
  return new Response(JSON.stringify({ value: `value-for-${id}` }), { status: 200 });
});
const base = (fetchImpl: ReturnType<typeof fetcher>) => ({
  token: "token-placeholder", teamId, projectId, projectName, fetchImpl,
});

describe("governed staging readable retrieval", () => {
  test("decrypts only the five allowlisted readable variables", async () => {
    const fetchImpl = fetcher();
    const values = await fetchReadableStagingEnvironment({
      ...base(fetchImpl), metadata: { envs: [...readable, ...sensitive] }, mode: "final", scope: "custom-environment",
    });
    expect(Object.keys(values)).toEqual(READABLE_STAGING_NAMES.final);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const requests = fetchImpl.mock.calls.map(([input]) => String(input));
    expect(requests.every((item) => new URL(item).searchParams.get("decrypt") === "true")).toBe(true);
    for (const entry of sensitive) expect(requests.join("\n")).not.toContain(entry.id);
  });

  test("rejects wrong custom scope before decrypting it", async () => {
    const fetchImpl = fetcher();
    const metadata = { envs: readable.map((entry) => entry.key === "NEXT_PUBLIC_APP_URL" ? { ...entry, customEnvironmentIds: ["env_wrong"] } : entry) };
    await expect(fetchReadableStagingEnvironment({
      ...base(fetchImpl), metadata, mode: "posture", scope: "custom-environment",
    })).rejects.toThrow("NEXT_PUBLIC_APP_URL");
    expect(fetchImpl.mock.calls.map(([input]) => String(input)).join("\n")).not.toContain("readable-2");
  });

  test("Sensitive allowlist metadata is unreachable", async () => {
    const fetchImpl = fetcher();
    const metadata = { envs: readable.map((entry) => entry.key === "NEXT_PUBLIC_APP_URL" ? { ...entry, type: "sensitive" } : entry) };
    await expect(fetchReadableStagingEnvironment({
      ...base(fetchImpl), metadata, mode: "posture", scope: "custom-environment",
    })).rejects.toThrow("not encrypted metadata");
    expect(fetchImpl.mock.calls.map(([input]) => String(input)).join("\n")).not.toContain("readable-2");
  });

  test("arbitrary names never bypass the allowlist", async () => {
    const fetchImpl = fetcher();
    await fetchReadableStagingEnvironment({
      ...base(fetchImpl), metadata: { envs: [...readable, { ...readable[0], key: "ARBITRARY", id: "arbitrary-id" }] }, mode: "posture", scope: "custom-environment",
    });
    expect(fetchImpl.mock.calls.map(([input]) => String(input)).join("\n")).not.toContain("arbitrary-id");
  });

  test("generic Preview source requires explicit source mode", async () => {
    const fetchImpl = fetcher();
    const source = readable.map((entry) => ({ ...entry, target: ["preview"], customEnvironmentIds: undefined }));
    const values = await fetchReadableStagingEnvironment({
      ...base(fetchImpl), metadata: { envs: source }, mode: "posture", scope: "source-preview",
    });
    expect(Object.keys(values)).toEqual(READABLE_STAGING_NAMES.posture);
  });

  test("errors never include response bodies or tokens", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret-response", { status: 403 }));
    await expect(fetchReadableStagingEnvironment({
      metadata: { envs: readable }, mode: "posture", scope: "custom-environment", token: "secret-token", teamId, projectId, projectName, fetchImpl,
    })).rejects.not.toThrow(/secret-response|secret-token/);
  });
});
