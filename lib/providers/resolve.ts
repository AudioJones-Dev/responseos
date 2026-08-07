export type ProviderFactory<T> = () => T

/**
 * Mock-first provider resolution (ADR-0001).
 * Env-absent → mock. Live factories are optional and unauthorized in the
 * CAL scaffold slice — when `createLive` is omitted, mock is always returned.
 */
export function resolveProvider<T>(options: {
  envVarName: string
  createMock: ProviderFactory<T>
  createLive?: ProviderFactory<T>
}): T {
  const configured = Boolean(process.env[options.envVarName]?.trim())
  if (!configured || !options.createLive) {
    return options.createMock()
  }
  return options.createLive()
}
