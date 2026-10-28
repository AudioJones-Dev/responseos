"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import type { SetupView } from "@/lib/clientSetup/service";

export function SetupForm({ setup, writable }: { setup?: SetupView; writable: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [facts, setFacts] = useState(setup?.draft.facts ?? []);
  const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "");
    try {
      const draft = {
        founderName: get("founderName"), contactNumber: get("contactNumber"), facts,
        disclosure: { text: get("disclosure"), purpose: get("purpose"), consentFlow: get("consentFlow"), refusalFlow: get("refusalFlow") },
      };
      const body = setup ? { revision: setup.draft.revision, draft } : {
        ...draft, businessName: get("businessName"), slug: get("slug"), industry: get("industry"), timezone: get("timezone"),
      };
      const response = await fetch(setup ? `/api/admin/client-setups/${setup.account.id}` : "/api/admin/client-setups", {
        method: setup ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.ok) { setMessage(result.error.message); return; }
      setMessage("Draft saved. Nothing has been published or activated.");
      router.push(`/admin/clients/${result.data.account.id}/setup`); router.refresh();
    } catch { setMessage("Draft could not be saved. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <Card className="mt-6"><h2 className="text-lg font-semibold text-ink">{setup ? "Edit setup draft" : "Create inactive client"}</h2>
    {!writable && <p className="mt-3 text-sm text-ink-secondary">Saving is blocked. Use the dedicated local test database and explicit local setup flag. Production destination remains unresolved.</p>}
    <form className="mt-5 space-y-4" onSubmit={submit}>
      <fieldset disabled={!writable || busy} className="grid gap-4 sm:grid-cols-2">
        {!setup && <>{[["businessName", "Business name"], ["slug", "Account slug"], ["industry", "Industry"], ["timezone", "Timezone"]].map(([name, label]) => <label key={name} className="text-sm">{label}<input className={inputClass} name={name} required maxLength={120} placeholder={name === "timezone" ? "America/New_York" : undefined} /></label>)}</>}
        <label className="text-sm">Founder name<input className={inputClass} name="founderName" required maxLength={120} defaultValue={setup?.draft.founderName} /></label>
        <label className="text-sm">Unverified business contact number<input className={inputClass} name="contactNumber" type="tel" required pattern="\+[1-9][0-9]{7,14}" placeholder="+12025550123" defaultValue={setup?.draft.contactNumber} /></label>
        <div className="space-y-3 sm:col-span-2"><p className="text-sm font-medium">Draft business facts</p>{facts.map((fact, index) => <div key={index} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-2">
          <label className="text-sm">Fact {index + 1} topic<input className={inputClass} required maxLength={120} value={fact.label} onChange={(e) => setFacts(facts.map((entry, i) => i === index ? { ...entry, label: e.target.value } : entry))} /></label>
          <label className="text-sm">Details<textarea className={inputClass} required maxLength={1000} value={fact.value} onChange={(e) => setFacts(facts.map((entry, i) => i === index ? { ...entry, value: e.target.value } : entry))} /></label>
          <Button type="button" variant="ghost" onClick={() => setFacts(facts.filter((_, i) => i !== index))}>Remove fact {index + 1}</Button>
        </div>)}<Button type="button" variant="secondary" disabled={facts.length >= 30} onClick={() => setFacts([...facts, { label: "", value: "" }])}>Add draft fact</Button></div>
        {([ ["disclosure", "Opening disclosure", "text"], ["purpose", "Actual capture purpose", "purpose"], ["consentFlow", "Proposed consent flow", "consentFlow"], ["refusalFlow", "Proposed refusal flow", "refusalFlow"] ] as const).map(([name, label, key]) => <label key={name} className="text-sm sm:col-span-2">{label}<textarea className={inputClass} name={name} rows={3} maxLength={name === "purpose" ? 1000 : 2000} defaultValue={setup?.draft.disclosure[key] ?? ""} /></label>)}
      </fieldset>
      <p className="text-sm text-ink-secondary">All content remains draft. Customer access and telephone activation require separate decisions.</p>
      <Button type="submit" disabled={!writable || busy}>{busy ? "Saving…" : setup ? "Save draft" : "Create inactive account"}</Button>
      <p role="status" aria-live="polite" className="text-sm">{message}</p>
    </form>
  </Card>;
}
