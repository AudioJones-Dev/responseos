import { heartbeatGrok } from "../../../lib/grok/service";
const [id, token] = process.argv.slice(2);
void heartbeatGrok(id, token).then(alive => {
  if (!alive) throw Error("fixture_worker_not_alive");
  process.stdout.write("ready");
  setInterval(() => { void heartbeatGrok(id, token); }, 3000);
}).catch(() => { process.exitCode = 1; });
