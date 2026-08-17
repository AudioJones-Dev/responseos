"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { recordMarketingEvent } from "@/lib/analytics/marketing";
import { calculateMonthlyRevenueExposure } from "@/lib/revenue/calculateRevenueExposure";

const inputClass =
  "mt-2 w-full rounded-lg border border-line bg-base/70 px-3 py-2.5 text-base text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function RevenueExposureEstimator() {
  const [missedCalls, setMissedCalls] = useState("");
  const [jobValue, setJobValue] = useState("");
  const [closeRate, setCloseRate] = useState("");
  const [showResult, setShowResult] = useState(false);
  const started = useRef(false);

  const inputs = useMemo(
    () => ({
      monthlyMissedCalls: Number(missedCalls),
      averageJobValueUsd: Number(jobValue),
      closeRatePct: Number(closeRate),
    }),
    [closeRate, jobValue, missedCalls],
  );

  const isComplete = missedCalls !== "" && jobValue !== "" && closeRate !== "";
  const isValid =
    isComplete &&
    Number.isInteger(inputs.monthlyMissedCalls) &&
    inputs.monthlyMissedCalls >= 0 &&
    inputs.monthlyMissedCalls <= 1_000_000 &&
    Number.isFinite(inputs.averageJobValueUsd) &&
    inputs.averageJobValueUsd >= 0 &&
    inputs.averageJobValueUsd <= 10_000_000 &&
    Number.isFinite(inputs.closeRatePct) &&
    inputs.closeRatePct >= 0 &&
    inputs.closeRatePct <= 100;

  const estimate = isValid ? calculateMonthlyRevenueExposure(inputs) : null;

  const auditHref = isValid
    ? `/audit?${new URLSearchParams({
        monthly_missed_calls: String(inputs.monthlyMissedCalls),
        avg_job_value_usd: String(inputs.averageJobValueUsd),
        close_rate_pct: String(inputs.closeRatePct),
      }).toString()}`
    : "/audit";

  function markStarted() {
    if (started.current) return;
    started.current = true;
    recordMarketingEvent("homepage_estimator_started");
  }

  return (
    <section
      id="revenue-estimator"
      aria-labelledby="estimator-title"
      className="rounded-xl border border-line-strong bg-glass-strong p-5 backdrop-blur sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Use your numbers
      </p>
      <h2
        id="estimator-title"
        className="mt-2 font-display text-2xl font-semibold text-ink"
      >
        Estimate the revenue exposed
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">
        This is a planning estimate, not a promise. No email is required.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          setShowResult(true);
          recordMarketingEvent("homepage_estimator_completed");
        }}
      >
        <label className="block text-sm font-medium text-ink-secondary">
          Missed new-customer calls each month
          <input
            className={inputClass}
            type="number"
            name="monthly_missed_calls"
            min="0"
            max="1000000"
            step="1"
            inputMode="numeric"
            value={missedCalls}
            onFocus={markStarted}
            onChange={(event) => {
              setMissedCalls(event.target.value);
              setShowResult(false);
            }}
            placeholder="20"
            required
          />
        </label>

        <label className="block text-sm font-medium text-ink-secondary">
          Average booked job value
          <span className="ml-1 text-ink-muted">(USD)</span>
          <input
            className={inputClass}
            type="number"
            name="avg_job_value_usd"
            min="0"
            max="10000000"
            step="1"
            inputMode="decimal"
            value={jobValue}
            onFocus={markStarted}
            onChange={(event) => {
              setJobValue(event.target.value);
              setShowResult(false);
            }}
            placeholder="850"
            required
          />
        </label>

        <label className="block text-sm font-medium text-ink-secondary">
          Typical close rate
          <span className="ml-1 text-ink-muted">(%)</span>
          <input
            className={inputClass}
            type="number"
            name="close_rate_pct"
            min="0"
            max="100"
            step="1"
            inputMode="decimal"
            value={closeRate}
            onFocus={markStarted}
            onChange={(event) => {
              setCloseRate(event.target.value);
              setShowResult(false);
            }}
            placeholder="30"
            required
            aria-describedby="close-rate-help"
          />
          <span id="close-rate-help" className="mt-1.5 block text-xs text-ink-muted">
            If 3 out of 10 qualified calls become jobs, enter 30.
          </span>
        </label>

        <button
          type="submit"
          disabled={!isValid}
          className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.36)] transition-[background-color,box-shadow] hover:bg-accent-hover hover:shadow-[0_0_0_6px_rgba(232,255,90,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Calculate exposure
        </button>
      </form>

      <div className="mt-5 min-h-32 border-t border-line pt-5" aria-live="polite">
        {showResult && estimate !== null ? (
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
              Estimated monthly revenue exposed
            </p>
            <output className="mt-2 block font-display text-4xl font-semibold text-accent">
              {usd.format(estimate)}
            </output>
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              Based only on your inputs. The audit validates which opportunities
              are qualified and realistically recoverable.
            </p>
            <Link
              href={auditHref}
              onClick={() =>
                recordMarketingEvent("homepage_estimate_audit_clicked")
              }
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-elevated"
            >
              Turn this estimate into a recovery plan
            </Link>
          </div>
        ) : (
          <p className="text-sm leading-6 text-ink-muted">
            Enter all three figures to see a transparent monthly estimate.
          </p>
        )}
      </div>
    </section>
  );
}
