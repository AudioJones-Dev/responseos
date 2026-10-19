export async function runGrokWatchdog(input: {
  loop: boolean;
  sweep: () => Promise<{ inspected: number; failed: number }>;
  pause: (milliseconds: number) => Promise<void>;
  alert: (scope: "session" | "sweep") => void;
}) {
  let failures = 0;
  do {
    let healthy = false;
    try {
      const result = await input.sweep();
      failures = 0;
      healthy = result.failed === 0;
      if (!healthy) input.alert("session");
    } catch {
      failures += 1;
      input.alert("sweep");
    }
    if (!input.loop) return healthy;
    await input.pause(Math.min(30000, 1000 * 2 ** Math.min(failures, 5)));
  } while (true);
}
