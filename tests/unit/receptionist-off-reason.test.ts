import { describe, expect, test } from "vitest";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import { receptionistOffReason } from "@/lib/professional";

describe("receptionistOffReason", () => {
  const profiles = getMockAgentProfiles();

  test("is null while an enabled profile exists", () => {
    expect(receptionistOffReason({ ok: true, data: profiles })).toBeNull();
  });

  test("names a failed read by its code only", () => {
    const reason = receptionistOffReason({
      ok: false,
      error: { code: "P1001", message: "Can't reach database server at db.example:5432" } as { code: string },
    });
    expect(reason).toBe("agent profile read failed (P1001)");
    expect(reason).not.toContain("db.example");
  });

  test("distinguishes missing rows from disabled ones", () => {
    expect(receptionistOffReason({ ok: true, data: [] })).toBe(
      "no agent profile rows for the internal demo account",
    );
    const disabled = profiles.map((profile) => ({ ...profile, enabled: false }));
    expect(receptionistOffReason({ ok: true, data: disabled })).toBe(
      `all ${disabled.length} agent profiles are disabled`,
    );
  });
});
