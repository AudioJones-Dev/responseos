import { AlertBanner } from "@/components/ui";

export function DemoDataBanner({
  source,
  error,
}: {
  source: "persisted" | "static-fallback";
  error?: string | null;
}) {
  if (source === "static-fallback") {
    return (
      <AlertBanner variant="warning" className="mb-6">
        Demo fallback — no persisted or live data is available. This page is a
        static fictional scenario. {error}
      </AlertBanner>
    );
  }

  return (
    <AlertBanner className="mb-6">
      Simulated scenario — tenant-scoped persisted demo data. No live calls,
      providers, CRM writes, calendar writes, or verified revenue.
    </AlertBanner>
  );
}
