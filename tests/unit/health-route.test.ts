import { afterEach, describe, expect, test } from "vitest";

import { GET } from "@/app/api/health/route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/health", () => {
  test("reports package and deployment identity without secrets", async () => {
    process.env.RESPONSEOS_BUILD_SHA = "abc123";
    process.env.VERCEL_ENV = "preview";

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "responseos",
      version: "0.2.0",
      build_sha: "abc123",
      environment: "preview",
    });
  });
});
