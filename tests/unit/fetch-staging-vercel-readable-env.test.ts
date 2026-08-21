import { describe, expect, test, vi } from "vitest";

import {
  READABLE_PREVIEW_NAMES,
  fetchReadablePreviewEnvironment,
} from "@/scripts/fetch-staging-vercel-readable-env.mjs";

const TEAM_ID = "team_BHxIkAGPW6qEKKQBAt9c0NGz";
const PROJECT_ID = "prj_pbzqdkzp322jcHWIsi19GhsnWXRm";
const PROJECT_NAME = "responseos-staging-mock";
const readableEntries = READABLE_PREVIEW_NAMES.final.map((key, index) => ({
  key,
  id: `readable-${index}`,
  target: ["preview"],
  type: "encrypted",
  gitBranch: null,
}));
const sensitiveEntries = [
  "DATABASE_URL",
  "DIRECT_URL",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
].map((key, index) => ({
  key,
  id: `sensitive-${index}`,
  target: ["preview"],
  type: "sensitive",
  gitBranch: null,
}));

describe("Vercel REST readable Preview retrieval", () => {
  test("retrieves only the allowlisted readable final configuration", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const id = new URL(String(input)).pathname.split("/").at(-1);
      return new Response(JSON.stringify({ value: `value-for-${id}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const values = await fetchReadablePreviewEnvironment({
      metadata: { envs: [...readableEntries, ...sensitiveEntries] },
      mode: "final",
      token: "token-placeholder",
      teamId: TEAM_ID,
      projectId: PROJECT_ID,
      projectName: PROJECT_NAME,
      fetchImpl,
    });

    expect(Object.keys(values)).toEqual(READABLE_PREVIEW_NAMES.final);
    expect(fetchImpl).toHaveBeenCalledTimes(READABLE_PREVIEW_NAMES.final.length);
    const requested = fetchImpl.mock.calls.map(([input]) => String(input));
    for (const entry of sensitiveEntries) {
      expect(requested.join("\n")).not.toContain(entry.id);
    }
  });

  test("rejects a readable allowlist entry marked Sensitive without requesting it", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      void input;
      return new Response(JSON.stringify({ value: "readable-placeholder" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const metadata = {
      envs: readableEntries.map((entry) =>
        entry.key === "NEXT_PUBLIC_APP_URL"
          ? { ...entry, type: "sensitive" }
          : entry,
      ),
    };

    await expect(
      fetchReadablePreviewEnvironment({
        metadata,
        mode: "posture",
        token: "token-placeholder",
        teamId: TEAM_ID,
        projectId: PROJECT_ID,
        projectName: PROJECT_NAME,
        fetchImpl,
      }),
    ).rejects.toThrow(
      "Readable Preview variable is not encrypted metadata: NEXT_PUBLIC_APP_URL",
    );
    expect(fetchImpl.mock.calls.map(([input]) => String(input)).join("\n")).not.toContain(
      "readable-2",
    );
  });

  test("fails closed on a Vercel project mismatch", async () => {
    await expect(
      fetchReadablePreviewEnvironment({
        metadata: { envs: readableEntries },
        mode: "posture",
        token: "token-placeholder",
        teamId: TEAM_ID,
        projectId: PROJECT_ID,
        projectName: "responseos",
        fetchImpl: vi.fn(),
      }),
    ).rejects.toThrow("Vercel readable Preview target is not canonical staging");
  });

  test("errors never include returned readable or token values", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("secret-response-body", { status: 403 }),
    );

    await expect(
      fetchReadablePreviewEnvironment({
        metadata: { envs: readableEntries },
        mode: "posture",
        token: "token-that-must-not-appear",
        teamId: TEAM_ID,
        projectId: PROJECT_ID,
        projectName: PROJECT_NAME,
        fetchImpl,
      }),
    ).rejects.not.toThrow(/secret-response-body|token-that-must-not-appear/);
  });
});
