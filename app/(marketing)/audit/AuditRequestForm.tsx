"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

const fieldCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none";
const labelCls = "mb-1.5 block text-xs font-medium text-ink-secondary";

type Status = "idle" | "submitting" | "success" | "error";

interface SuccessData {
  reference: string;
}

export function AuditRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries()) as Record<string, string>;

    // Omit empty optionals; coerce the numeric fields the API expects.
    const payload: Record<string, unknown> = {
      name: raw.name,
      email: raw.email,
      business_name: raw.business_name,
    };
    if (raw.phone) payload.phone = raw.phone;
    if (raw.industry) payload.industry = raw.industry;
    if (raw.monthly_missed_calls)
      payload.monthly_missed_calls = Number(raw.monthly_missed_calls);
    if (raw.avg_job_value_usd)
      payload.avg_job_value_usd = Number(raw.avg_job_value_usd);
    if (raw.notes) payload.notes = raw.notes;

    try {
      const res = await fetch("/api/audit-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: SuccessData;
        error?: { message: string };
      };
      if (!res.ok || !body.ok) {
        setError(body.error?.message ?? "Something went wrong. Try again.");
        setStatus("error");
        return;
      }
      setReference(body.data?.reference ?? "");
      setStatus("success");
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <Card className="border-line-strong">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Request received
        </p>
        <h3 className="mt-2 font-display text-xl font-semibold text-ink">
          Your audit is queued
        </h3>
        <p className="mt-2 text-sm text-ink-secondary">
          We&apos;ll map your missed-demand surface and follow up with a
          recovery plan and a 30-day recovered-revenue estimate. No spam, no
          sales pressure.
        </p>
        {reference ? (
          <p className="mt-4 font-mono text-xs text-ink-muted">
            Reference: {reference}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required className={fieldCls} />
      </div>
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="business_name">
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          required
          className={fieldCls}
        />
      </div>
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={fieldCls}
        />
      </div>
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="phone">
          Phone <span className="text-ink-muted">(optional)</span>
        </label>
        <input id="phone" name="phone" type="tel" className={fieldCls} />
      </div>
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="industry">
          Industry <span className="text-ink-muted">(optional)</span>
        </label>
        <select id="industry" name="industry" className={fieldCls}>
          <option value="">Select…</option>
          <option value="contractors">Contractors</option>
          <option value="home_services">Home services</option>
          <option value="med_spas">Med spas</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="monthly_missed_calls">
          Missed calls / month{" "}
          <span className="text-ink-muted">(optional)</span>
        </label>
        <input
          id="monthly_missed_calls"
          name="monthly_missed_calls"
          type="number"
          min="0"
          inputMode="numeric"
          className={fieldCls}
        />
      </div>
      <div className="sm:col-span-1">
        <label className={labelCls} htmlFor="avg_job_value_usd">
          Avg job value (USD){" "}
          <span className="text-ink-muted">(optional)</span>
        </label>
        <input
          id="avg_job_value_usd"
          name="avg_job_value_usd"
          type="number"
          min="0"
          inputMode="numeric"
          className={fieldCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor="notes">
          Anything else? <span className="text-ink-muted">(optional)</span>
        </label>
        <textarea id="notes" name="notes" rows={3} className={fieldCls} />
      </div>

      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" glow disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Request my audit"}
        </Button>
        {status === "error" ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <p className="text-xs text-ink-muted">
            Mock capture — no data leaves this demo.
          </p>
        )}
      </div>
    </form>
  );
}
