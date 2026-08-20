import { notFound } from "next/navigation";
import { AlertBanner, ButtonLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

function displayPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1")
    ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    : value;
}

export default function LiveCallDemoPage() {
  if (process.env.RESPONSEOS_LIVE_CALL_DEMO_PUBLIC !== "true") notFound();
  const number = process.env.RESPONSEOS_DEMO_PHONE_E164;
  if (!number) notFound();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-16">
      <AlertBanner variant="warning">
        <strong>Supervised demonstration.</strong>{" "}
        This number connects to an automated AI assistant in a controlled demo.
        The conversation may be transcribed so ResponseOS can display the demo evidence.
        Recording is disabled.
      </AlertBanner>
      <Card className="mt-6 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          ResponseOS live-call demonstration
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          Call {displayPhone(number)}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-ink-secondary">
          Use fictional or non-sensitive information only. The assistant can capture a
          callback request and qualification details, but it does not schedule meetings,
          place outbound calls, or make binding service commitments.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href={`tel:${number}`}>Call the demo assistant</ButtonLink>
          <ButtonLink href="/demo" variant="secondary">View mock walkthrough</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
