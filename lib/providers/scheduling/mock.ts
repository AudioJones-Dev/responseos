import type {
  SchedulingLink,
  SchedulingProvider,
} from "@/lib/providers/scheduling/types";

export class MockSchedulingProvider implements SchedulingProvider {
  readonly id = "calendly" as const;

  async getBookingLink(input: {
    accountId: string;
  }): Promise<SchedulingLink> {
    return {
      url: `https://calendly.example/mock/${input.accountId}`,
      provider: "calendly",
    };
  }
}
