import type { CrmContactRef, CrmProvider } from "@/lib/providers/crm/types";

export class MockCrmProvider implements CrmProvider {
  readonly id = "hubspot" as const;

  async upsertContact(input: {
    email: string;
    name: string;
  }): Promise<CrmContactRef> {
    void input.name;
    return { externalId: `mock_crm_${input.email}`, email: input.email };
  }
}
