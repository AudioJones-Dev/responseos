import { createServer } from "node:http";

const port = Number(process.env.PORT);
if (process.env.RESPONSEOS_GROK_WATCHDOG_MODE !== "inactive" ||
    !/^[1-9]\d{0,4}$/.test(process.env.PORT ?? "") || port < 1024 || port > 65535) {
  console.error("Inactive service configuration rejected.");
  process.exitCode = 1;
} else {
  const body = JSON.stringify({ status: "inactive", monitoring: false, callsEnabled: false, disconnectionEvidence: false });
  const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
    const healthy = request.url === "/healthz" && ["GET", "HEAD"].includes(request.method);
    response.writeHead(healthy ? 200 : 404, {
      "Content-Type": "application/json", "Cache-Control": "no-store", "Connection": "close",
    });
    response.end(request.method === "HEAD" ? undefined : healthy ? body : '{"status":"not_found"}');
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => server.closeAllConnections(), 1000);
    server.close(() => {
      clearTimeout(deadline);
      console.info("Inactive service stopped; no monitoring was active.");
    });
    server.closeIdleConnections();
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  server.on("error", () => { console.error("Inactive service listener failed."); process.exitCode = 1; });
  server.listen(port, "0.0.0.0", () => console.info("Inactive service listening; no monitoring or call capability."));
}
