export function sanitizeCrmText(value: string | null | undefined): string {
  return (value ?? "No call summary was generated.")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000)
}
