import { readFile } from "node:fs/promises";
import { assertGrokQualified } from "../lib/grok/provider";
import { createGrokMediaServer, parseMediaListenerConfig } from "../lib/grok/mediaServer";
import { db } from "../lib/db/client";

async function main() {
  assertGrokQualified();
  const config = parseMediaListenerConfig(JSON.parse(await readFile(process.argv[2], "utf8")), process.env.PORT);
  const ingress = config.ingress === "direct-tls"
    ? { ingress: config.ingress, tls: { cert: await readFile(config.certificatePath), key: await readFile(config.privateKeyPath) } }
    : { ingress: config.ingress };
  const runtime = createGrokMediaServer({ ...ingress, streamUrl: config.streamUrl, publicKey: config.publicKey, realtime: { mode: config.mode, apiKey: () => process.env.XAI_API_KEY ?? "" }, fault: () => console.error("Grok transport failed; inspect call status and operator fallback.") });
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await runtime.close(); await db?.$disconnect(); };
  process.once("SIGINT", () => { void shutdown(); }); process.once("SIGTERM", () => { void shutdown(); });
  runtime.server.on("error", () => { console.error("Grok listener failed; values withheld."); void shutdown(); process.exitCode = 1; });
  runtime.server.listen(config.port, "0.0.0.0");
}
void main().catch(async () => { console.error("Grok listener disabled or invalid; values withheld."); await db?.$disconnect(); process.exitCode = 1; });
