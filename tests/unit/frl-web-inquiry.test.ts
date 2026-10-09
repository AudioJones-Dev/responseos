import { expect, test } from "vitest";
import { FrlWebInquirySchema } from "@/lib/validation/frl-web-inquiry";

const request = {
  schemaVersion: 1,
  need: "Service or repair",
  equipment: "Stair lift",
  building: "Home",
  city: "Synthetic",
  name: "Test",
  email: "test@example.com",
  sourcePage: "/",
  contactConsent: true,
  audience: "homeowner",
};
test("accepts homeowner without invented organization or professional details", () => {
  expect(FrlWebInquirySchema.parse(request)).toMatchObject({
    audience: "homeowner",
    emailUpdates: false,
  });
});
test("requires professional role and stage", () => {
  expect(
    FrlWebInquirySchema.safeParse({ ...request, audience: "builder" }).success,
  ).toBe(false);
});
test.each([
  { accountId: "attacker" },
  { contactConsent: false },
  { schemaVersion: 2 },
  { sourcePage: "//evil.example" },
])("rejects untrusted scope or invalid contract %j", (patch) => {
  expect(FrlWebInquirySchema.safeParse({ ...request, ...patch }).success).toBe(
    false,
  );
});
