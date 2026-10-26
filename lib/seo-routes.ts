// Public, indexable marketing routes. The demo sandbox screens are left out
// on purpose: they run on fictional records and carry a noindex.
export const INDEXABLE_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/audit", priority: 0.9 },
  { path: "/pricing", priority: 0.8 },
  { path: "/demo", priority: 0.8 },
  { path: "/industries/home-services", priority: 0.7 },
  { path: "/industries/contractors", priority: 0.7 },
  { path: "/trust", priority: 0.6 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
] as const;
