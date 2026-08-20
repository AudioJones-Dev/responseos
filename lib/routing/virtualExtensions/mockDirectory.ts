import type { VirtualExtensionDefinition } from "@/lib/routing/virtualExtensions/types"

export const MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS = {
  accountA: "acct_route_mock_a",
  accountB: "acct_route_mock_b",
} as const

const MOCK_DIRECTORIES: Readonly<Record<string, readonly VirtualExtensionDefinition[]>> = {
  [MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountA]: [
    {
      accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountA,
      extensionId: "ext_mock_a_operator",
      code: "0",
      aliases: ["operator"],
      label: "Operator fallback",
      policyRef: "policy_mock_a_operator_v1",
      policyVersion: 1,
      destinationRef: "dest_mock_a_message_capture",
      destinationType: "message_capture",
    },
    {
      accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountA,
      extensionId: "ext_mock_a_sales",
      code: "101",
      aliases: ["sales"],
      label: "Sales",
      policyRef: "policy_mock_a_sales_v1",
      policyVersion: 1,
      destinationRef: "dest_mock_a_sales_human",
      destinationType: "human_pstn",
    },
  ],
  [MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountB]: [
    {
      accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountB,
      extensionId: "ext_mock_b_operator",
      code: "0",
      aliases: ["operator"],
      label: "Operator fallback",
      policyRef: "policy_mock_b_operator_v1",
      policyVersion: 1,
      destinationRef: "dest_mock_b_message_capture",
      destinationType: "message_capture",
    },
    {
      accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountB,
      extensionId: "ext_mock_b_support",
      code: "101",
      aliases: ["support"],
      label: "Support",
      policyRef: "policy_mock_b_support_v1",
      policyVersion: 1,
      destinationRef: "dest_mock_b_support_human",
      destinationType: "human_pstn",
    },
  ],
}

export function getMockVirtualExtensionDirectory(
  accountId: string,
): readonly VirtualExtensionDefinition[] | undefined {
  return MOCK_DIRECTORIES[accountId]
}
