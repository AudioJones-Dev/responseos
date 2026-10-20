import { registerHooks, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";

const observed = { businessImports: 0, networkActions: 0 };
function deniedNetwork() {
  observed.networkActions++;
  throw Error("synthetic_network_tripwire");
}
net.Socket.prototype.connect = deniedNetwork;
tls.connect = deniedNetwork;
http.request = http.get = https.request = https.get = deniedNetwork;
globalThis.fetch = deniedNetwork;
syncBuiltinESMExports();
registerHooks({
  resolve(specifier, context, next) {
    if (/lib\/(db|providers)\b|lib\/grok\/(service|provider)\b|@prisma\/client/.test(specifier)) {
      observed.businessImports++;
      throw Error("synthetic_business_import_tripwire");
    }
    return next(specifier, context);
  },
});
process.on("exit", () => console.error(`ZERO_ACTIONS=${JSON.stringify(observed)}`));
