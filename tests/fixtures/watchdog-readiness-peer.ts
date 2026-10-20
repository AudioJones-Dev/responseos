import { createWatchdogReadinessWriter } from "../../lib/grok/watchdogReadiness";
import { createWatchdogReadinessServer } from "../../lib/grok/watchdogRemoteReadiness";

const writer = createWatchdogReadinessWriter();
writer.completed(true);
setInterval(() => writer.completed(true), 500);
const server = createWatchdogReadinessServer();
server.listen(0, "127.0.0.1", () => {
  process.send?.({ port: (server.address() as { port: number }).port });
});
