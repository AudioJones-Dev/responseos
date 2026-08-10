import type { Account } from "@/types/account";

export function isCommercialAccount(
  account: Pick<Account, "account_type">,
): boolean {
  return account.account_type === "customer";
}

export function filterCommercialRecords<T extends { account_id: string }>(
  records: T[],
  accounts: Array<Pick<Account, "id" | "account_type">>,
): T[] {
  const customerIds = new Set(
    accounts.filter(isCommercialAccount).map((account) => account.id),
  );
  return records.filter((record) => customerIds.has(record.account_id));
}
