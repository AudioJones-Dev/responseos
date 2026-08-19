import { AlertBanner } from "@/components/ui";

export function DemoDataBanner(props: {
  source: "persisted" | "static-fallback";
  error: string | null;
}) {
  return (
    <AlertBanner variant={props.source === "persisted" ? "info" : "warning"} className="mb-6">
      {props.source === "persisted"
        ? "Fictional records persisted in an isolated ResponseOS sandbox. Values are illustrative; no live provider action or verified recovered revenue is represented."
        : `Static fictional fallback only. No database or provider evidence is available${props.error ? ` (${props.error})` : ""}.`}
    </AlertBanner>
  );
}
