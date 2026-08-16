import type { AccountType } from "@/types/account";

/**
 * Only `customer` tenants contribute to customer revenue reporting
 * (ADR-0046). Internal, internal-demo, and sandbox tenants stay visible
 * in operational, provider-cost, QA, and reliability metrics — the
 * point of dogfooding is that their usage is measured — but they never
 * count as paid customers or as recovered customer revenue.
 */
export const CUSTOMER_REVENUE_ACCOUNT_TYPES: readonly AccountType[] = [
  "customer",
];

export function countsTowardCustomerRevenue(accountType: AccountType): boolean {
  return CUSTOMER_REVENUE_ACCOUNT_TYPES.includes(accountType);
}
