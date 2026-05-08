const counters = new Map<string, number>();

export function nextTestId(prefix: string): string {
  const next = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, next);
  return `${prefix}_test_${String(next).padStart(3, "0")}`;
}

export function resetFactoryCounters(): void {
  counters.clear();
}
