import { describe, expect, test } from "vitest";
import {
  filterCommercialRecords,
  isCommercialAccount,
} from "@/lib/reporting/accountClassification";
import { MockAccount } from "@/types/account";

describe("account classification reporting policy", () => {
  const accounts = [
    MockAccount({ id: "customer", account_type: "customer" }),
    MockAccount({ id: "internal", account_type: "internal" }),
    MockAccount({ id: "internal-demo", account_type: "internal_demo" }),
    MockAccount({ id: "sandbox", account_type: "sandbox" }),
  ];

  test("only customer accounts contribute to commercial reporting", () => {
    expect(accounts.filter(isCommercialAccount).map((account) => account.id)).toEqual([
      "customer",
    ]);
  });

  test("internal and sandbox records remain available outside commercial totals", () => {
    const records = accounts.map((account) => ({
      account_id: account.id,
      amount: 100,
    }));

    expect(filterCommercialRecords(records, accounts)).toEqual([
      { account_id: "customer", amount: 100 },
    ]);
    expect(records).toHaveLength(4);
  });
});
