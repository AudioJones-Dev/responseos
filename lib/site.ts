const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      // Use the local URL when a developer supplied a malformed value.
    }
  }

  return new URL(LOCAL_SITE_URL);
}

export function absoluteSiteUrl(path = "/"): string {
  return new URL(path, getSiteUrl()).toString();
}
