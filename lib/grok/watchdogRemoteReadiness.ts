import { createHmac, createPrivateKey, createPublicKey, randomBytes, sign, timingSafeEqual, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { isAbsolute } from "node:path";
import { localWatchdogReady, watchdogBinding, WATCHDOG_FRESHNESS_MS } from "./watchdogReadiness";

export const WATCHDOG_REQUEST_MS = 500;
function key() {
  const value = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_KEY;
  if (!/^[0-9a-f]{64}$/.test(value ?? "")) throw Error("watchdog_auth_unconfigured");
  return Buffer.from(value!, "hex");
}
function identity() {
  const { applicationSha, controlSha, instanceId } = watchdogBinding(false);
  return { applicationSha, controlSha, instanceId };
}
function publicKey() {
  const value = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_PUBLIC_KEY ?? "";
  if (!/^[A-Za-z0-9+/]{59}=$/.test(value)) throw Error("watchdog_signer_unconfigured");
  const result = createPublicKey({ key: Buffer.from(value, "base64"), format: "der", type: "spki" });
  if (result.asymmetricKeyType !== "ed25519") throw Error("watchdog_signer_invalid");
  return result;
}
function signedByWatchdog(raw: string, signature: string | null, trusted: ReturnType<typeof publicKey>) {
  if (!signature || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
  return verify(null, Buffer.from(`response-v1\n${raw}`), trusted, Buffer.from(signature, "base64"));
}
function mac(secret: Buffer, purpose: string, value: string) {
  return createHmac("sha256", secret).update(`${purpose}\n${value}`).digest("hex");
}
function matches(expected: string, supplied: string | null | undefined) {
  return /^[0-9a-f]{64}$/.test(supplied ?? "") &&
    timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied!, "hex"));
}

export async function remoteWatchdogDeadline() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WATCHDOG_REQUEST_MS);
  try {
    const expected = identity(), secret = key(), trusted = publicKey();
    const url = new URL(process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.pathname !== "/readiness") return false;
    const nonce = randomBytes(32).toString("hex");
    const challenge = JSON.stringify({ ...expected, nonce });
    const started = performance.now();
    const response = await fetch(url, {
      method: "GET", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: { "x-watchdog-challenge": nonce, "x-watchdog-auth": mac(secret, "request-v1", challenge) },
    });
    if (response.status !== 200 || response.headers.get("content-type") !== "application/json" || !response.body) return false;
    const reader = response.body.getReader();
    let bytes = Buffer.alloc(0);
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (bytes.length + chunk.value.length > 1024) return false;
        bytes = Buffer.concat([bytes, chunk.value]);
      }
    } finally { await reader.cancel(); }
    const elapsed = performance.now() - started;
    if (controller.signal.aborted || elapsed < 0 || elapsed >= WATCHDOG_REQUEST_MS) return false;
    const raw = bytes.toString("utf8");
    if (!signedByWatchdog(raw, response.headers.get("x-watchdog-signature"), trusted)) return false;
    const proof = JSON.parse(raw);
    const valid = proof.version === 1 && proof.nonce === nonce && proof.ready === true &&
      proof.applicationSha === expected.applicationSha && proof.controlSha === expected.controlSha &&
      proof.instanceId === expected.instanceId && Number.isFinite(proof.ageMs) && proof.ageMs >= 0 &&
      proof.ageMs + elapsed < WATCHDOG_FRESHNESS_MS;
    return valid ? started + WATCHDOG_FRESHNESS_MS - proof.ageMs : false;
  } catch { return false; }
  finally { clearTimeout(timer); controller.abort(); }
}

// Only the active loop owns this listener; health probes cannot publish sweep proof.
export function createWatchdogReadinessServer() {
  const expected = identity(), secret = key(), file = watchdogBinding().file;
  const signingFile = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_SIGNING_KEY_FILE ?? "";
  if (!isAbsolute(signingFile)) throw Error("watchdog_signer_unconfigured");
  const signingBytes = readFileSync(signingFile);
  if (signingBytes.length > 1024) throw Error("watchdog_signer_invalid");
  const privateKey = createPrivateKey(signingBytes);
  const trusted = publicKey();
  if (privateKey.asymmetricKeyType !== "ed25519" ||
      !createPublicKey(privateKey).equals(trusted)) throw Error("watchdog_signer_mismatch");
  const server = createServer({ maxHeaderSize: 4096 }, (request, response) => {
    response.setHeader("cache-control", "no-store");
    const nonce = request.headers["x-watchdog-challenge"], auth = request.headers["x-watchdog-auth"];
    const unique = ["x-watchdog-challenge", "x-watchdog-auth"].every(name =>
      request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length === 1);
    if (request.method !== "GET" || request.url !== "/readiness" || !unique ||
        typeof nonce !== "string" || !/^[0-9a-f]{64}$/.test(nonce) || typeof auth !== "string" ||
        !matches(mac(secret, "request-v1", JSON.stringify({ ...expected, nonce })), auth)) {
      response.writeHead(403); response.end(); return;
    }
    try {
      const now = Date.now();
      if (!localWatchdogReady(now)) throw Error();
      const bytes = readFileSync(file, "utf8");
      if (bytes.length > 1024) throw Error();
      const proof = JSON.parse(bytes), ageMs = now - proof.completedAt;
      if (proof.applicationSha !== expected.applicationSha || proof.controlSha !== expected.controlSha ||
          proof.instanceId !== expected.instanceId || proof.mode !== "active" || proof.loop !== true ||
          proof.version !== 1 || !Number.isSafeInteger(proof.completedAt) || ageMs < 0 || ageMs >= WATCHDOG_FRESHNESS_MS) throw Error();
      const body = JSON.stringify({ version: 1, ...expected, nonce, ready: true, ageMs });
      response.writeHead(200, { "content-type": "application/json",
        "x-watchdog-signature": sign(null, Buffer.from(`response-v1\n${body}`), privateKey).toString("base64") });
      response.end(body);
    } catch { response.writeHead(503); response.end(); }
  });
  server.requestTimeout = 1000; server.headersTimeout = 1000; server.keepAliveTimeout = 1;
  return server;
}
