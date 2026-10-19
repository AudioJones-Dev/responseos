import { readFile } from "node:fs/promises";
import { z } from "zod";
import { assertGrokQualified } from "../lib/grok/provider";
import { createGrokMediaServer } from "../lib/grok/mediaServer";
import { db } from "../lib/db/client";

async function main() {
  assertGrokQualified();
  const config = z.object({ mode: z.literal("production"), streamUrl: z.string().url(), publicKey: z.string(), certificatePath: z.string(), privateKeyPath: z.string(), port: z.number().int().min(1024).max(65535) }).strict().parse(JSON.parse(await readFile(process.argv[2], "utf8")));
  const runtime = createGrokMediaServer({ streamUrl: config.streamUrl, publicKey: config.publicKey, tls: { cert: await readFile(config.certificatePath), key: await readFile(config.privateKeyPath) }, realtime: { mode: config.mode, apiKey: () => process.env.XAI_API_KEY ?? "" }, fault: () => console.error("Grok transport failed; inspect call status and operator fallback.") });
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await runtime.close(); await db?.$disconnect(); };
  process.once("SIGINT", () => { void shutdown(); }); process.once("SIGTERM", () => { void shutdown(); });
  runtime.server.on("error", () => { console.error("Grok listener failed; values withheld."); void shutdown(); process.exitCode = 1; });
  runtime.server.listen(config.port, "0.0.0.0");
}
void main().catch(async () => { console.error("Grok listener disabled or invalid; values withheld."); await db?.$disconnect(); process.exitCode = 1; });
