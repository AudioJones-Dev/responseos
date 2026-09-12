import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

export const MAX_PROSPECT_PAGES = 20;
export const MAX_PROSPECT_PAGE_BYTES = 2 * 1024 * 1024;
export const PROSPECT_FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "ResponseOS-ProspectBootstrap/1.0 (+https://responseos.ai/trust)";

export interface AcquiredWebsitePage {
  url: string;
  normalizedUrl: string;
  httpStatus: number;
  contentType: string;
  contentHash: string;
  extractedText: string;
  fetchedAt: string;
  links: string[];
}

export interface WebsiteAcquisitionResult {
  canonicalUrl: string;
  pages: AcquiredWebsitePage[];
  blockedUrls: Array<{ url: string; reason: string }>;
}

type LookupAddress = { address: string; family: number };
type LookupFn = (hostname: string) => Promise<LookupAddress[]>;
type FetchFn = typeof fetch;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family === 6) return !isPrivateIpv6(address);
  return false;
}

async function defaultLookup(hostname: string): Promise<LookupAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

export function normalizeProspectUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || url.port === "80") url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "fbclid") {
      url.searchParams.delete(key);
    }
  }
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export async function assertSafePublicWebsiteUrl(
  value: string,
  lookupFn: LookupFn = defaultLookup,
): Promise<URL> {
  return (await resolveSafePublicWebsiteUrl(value, lookupFn)).url;
}

async function resolveSafePublicWebsiteUrl(
  value: string,
  lookupFn: LookupFn,
): Promise<{ url: URL; address: LookupAddress }> {
  const url = new URL(normalizeProspectUrl(value));
  if (url.protocol !== "https:") throw new Error("website_https_required");
  if (url.port) throw new Error("website_port_forbidden");
  if (url.username || url.password) throw new Error("website_credentials_forbidden");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("website_private_host_forbidden");
  }
  const addresses = await lookupFn(url.hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("website_private_address_forbidden");
  }
  return { url, address: addresses[0] };
}

async function pinnedHttpsFetch(url: URL, init: RequestInit, address: LookupAddress): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      signal: init.signal ?? undefined,
      servername: url.hostname,
      lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        callback(null, address.address, address.family);
      }) as never,
    }, (response) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
        else if (value !== undefined) headers.set(name, String(value));
      }
      resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
        status: response.statusCode ?? 500,
        statusText: response.statusMessage,
        headers,
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function extractSafeTextFromHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|form|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(input|button|select|textarea|object|embed|link|meta)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, 100_000);
}

export function extractSameOriginLinks(html: string, pageUrl: URL, canonicalOrigin: string): string[] {
  const links = new Set<string>();
  const pattern = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const url = new URL(match[1], pageUrl);
      if (url.origin !== canonicalOrigin || url.protocol !== "https:") continue;
      if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?)$/i.test(url.pathname)) continue;
      links.add(normalizeProspectUrl(url.toString()));
    } catch {
      continue;
    }
  }
  return [...links].sort();
}

export function robotsAllowsPath(robotsText: string, pathname: string): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | null = null;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current || (key !== "allow" && key !== "disallow") || !value) continue;
    current.rules.push({ allow: key === "allow", path: value });
  }
  const exact = groups.filter((group) => group.agents.includes("responseos-prospectbootstrap"));
  const applicable = exact.length > 0 ? exact : groups.filter((group) => group.agents.includes("*"));
  const matching = applicable.flatMap((group) => group.rules).filter((rule) => pathname.startsWith(rule.path));
  if (matching.length === 0) return true;
  matching.sort((left, right) => right.path.length - left.path.length || Number(right.allow) - Number(left.allow));
  return matching[0].allow;
}

async function fetchWithSafeRedirects(params: {
  url: URL;
  fetchFn?: FetchFn;
  lookupFn: LookupFn;
}): Promise<{ response: Response; finalUrl: URL }> {
  let current = params.url;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const resolved = await resolveSafePublicWebsiteUrl(current.toString(), params.lookupFn);
    current = resolved.url;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROSPECT_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      const init = {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html, text/plain;q=0.9", "user-agent": USER_AGENT },
      } satisfies RequestInit;
      response = params.fetchFn
        ? await params.fetchFn(current, init)
        : await pinnedHttpsFetch(current, init, resolved.address);
    } finally {
      clearTimeout(timeout);
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current };
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("website_redirect_missing_location");
    current = await assertSafePublicWebsiteUrl(new URL(location, current).toString(), params.lookupFn);
  }
  throw new Error("website_redirect_limit_exceeded");
}

async function readBoundedBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PROSPECT_PAGE_BYTES) {
    throw new Error("website_page_too_large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PROSPECT_PAGE_BYTES) {
      await reader.cancel("website_page_too_large");
      throw new Error("website_page_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readRobots(params: {
  canonical: URL;
  fetchFn?: FetchFn;
  lookupFn: LookupFn;
}): Promise<string> {
  const robotsUrl = new URL("/robots.txt", params.canonical);
  const { response } = await fetchWithSafeRedirects({
    url: robotsUrl,
    fetchFn: params.fetchFn,
    lookupFn: params.lookupFn,
  });
  if (response.status === 404) return "";
  if (!response.ok) throw new Error("website_robots_unavailable");
  return readBoundedBody(response);
}

export async function acquireProspectWebsite(params: {
  canonicalUrl: string;
  fetchFn?: FetchFn;
  lookupFn?: LookupFn;
  approvedSameSiteUrls?: string[];
  now?: Date;
}): Promise<WebsiteAcquisitionResult> {
  const lookupFn = params.lookupFn ?? defaultLookup;
  const canonical = await assertSafePublicWebsiteUrl(params.canonicalUrl, lookupFn);
  const robots = await readRobots({ canonical, fetchFn: params.fetchFn, lookupFn });
    const approvedUrls = params.approvedSameSiteUrls ?? [];
    if (approvedUrls.length > MAX_PROSPECT_PAGES - 1) throw new Error("website_approved_url_limit_exceeded");
    const queue = [normalizeProspectUrl(canonical.toString())];
    for (const value of approvedUrls) {
      const approved = new URL(value, canonical);
      if (approved.protocol !== "https:" || approved.origin !== canonical.origin) {
        throw new Error("website_approved_url_outside_canonical_origin");
      }
      const normalized = normalizeProspectUrl(approved.toString());
      if (!queue.includes(normalized)) queue.push(normalized);
    }
    const visited = new Set<string>();
    const pages: AcquiredWebsitePage[] = [];
    const blockedUrls: Array<{ url: string; reason: string }> = [];

    while (queue.length > 0 && pages.length < MAX_PROSPECT_PAGES) {
      const requested = queue.shift()!;
      if (visited.has(requested)) continue;
      visited.add(requested);
      const requestedUrl = new URL(requested);
      if (!robotsAllowsPath(robots, requestedUrl.pathname)) {
        blockedUrls.push({ url: requested, reason: "robots_disallowed" });
        continue;
      }
      try {
        const { response, finalUrl } = await fetchWithSafeRedirects({
          url: requestedUrl,
          fetchFn: params.fetchFn,
          lookupFn,
        });
        if (!response.ok) throw new Error(`website_http_${response.status}`);
        if (finalUrl.origin !== canonical.origin) throw new Error("website_cross_origin_redirect");
        const contentType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
        if (contentType !== "text/html" && contentType !== "text/plain") {
          throw new Error("website_content_type_forbidden");
        }
        const body = await readBoundedBody(response);
        const normalizedUrl = normalizeProspectUrl(finalUrl.toString());
        const links = contentType === "text/html"
          ? extractSameOriginLinks(body, finalUrl, canonical.origin)
          : [];
        pages.push({
          url: finalUrl.toString(),
          normalizedUrl,
          httpStatus: response.status,
          contentType,
          contentHash: createHash("sha256").update(body).digest("hex"),
          extractedText: contentType === "text/html" ? extractSafeTextFromHtml(body) : body.trim().slice(0, 100_000),
          fetchedAt: (params.now ?? new Date()).toISOString(),
          links,
        });
      } catch (error) {
        blockedUrls.push({
          url: requested,
          reason: error instanceof Error ? error.message : "website_acquisition_failed",
        });
      }
    }
    return { canonicalUrl: normalizeProspectUrl(canonical.toString()), pages, blockedUrls };
}
