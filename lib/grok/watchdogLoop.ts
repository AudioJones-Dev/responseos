export async function runGrokWatchdog(input: {
  loop: boolean;
  sweep: () => Promise<{ inspected: number; failed: number }>;
  pause: (milliseconds: number) => Promise<void>;
  alert: (scope: "session" | "sweep", event: "incident" | "summary" | "recovered", occurrences: number) => void;
  now?: () => number;
}) {
  let failures = 0;
  const incidents = new Map<"session" | "sweep", { last: number; count: number }>();
  const now = input.now ?? (() => performance.now());
  function report(scope: "session" | "sweep", failing: boolean) {
    const prior = incidents.get(scope), at = now();
    if (!failing) {
      if (prior) { input.alert(scope, "recovered", prior.count); incidents.delete(scope); }
      return;
    }
    if (!prior) { incidents.set(scope, { last: at, count: 1 }); input.alert(scope, "incident", 1); }
    else {
      prior.count += 1;
      if (at - prior.last >= 60000) { input.alert(scope, "summary", prior.count); prior.last = at; }
    }
  }
  do {
    let healthy = false;
    try {
      const result = await input.sweep();
      failures = 0;
      healthy = result.failed === 0;
      report("sweep", false);
      report("session", !healthy);
    } catch {
      failures += 1;
      report("sweep", true);
    }
    if (!input.loop) return healthy;
    await input.pause(Math.min(30000, 1000 * 2 ** Math.min(failures, 5)));
  } while (true);
}
