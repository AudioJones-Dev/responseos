import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Node = { type: string; props: { children?: unknown; role?: string; disabled?: boolean; onClick?: () => void } };
const source = readFileSync("app/(admin)/admin/frl-pilot/pilot-controls.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  const node = tree as Node;
  return [node, ...nodes(node.props?.children)];
}
async function harness() {
  const state: unknown[] = [];
  const effects: (() => void)[] = [];
  const requests: { method?: string; body?: string }[] = [];
  let cursor = 0, mounted = false;
  let poll = () => {};
  const control = { postOk: false, getOk: true, pending: true, expired: false, automatic: false, empty: false, windowOpen: true };
  const exports = {} as { default: () => unknown };
  const jsx = (type: string, props: Node["props"]) => ({ type, props });
  runInNewContext(code, {
    exports, Date, JSON, Error,
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name !== "react") throw new Error(name);
      return {
        useState(initial: unknown) {
          const i = cursor++;
          if (!(i in state)) state[i] = initial;
          return [state[i], (value: unknown) => { state[i] = value; }];
        },
        useEffect(fn: () => void) { if (!mounted) effects.push(fn); },
      };
    },
    setInterval(fn: () => void) { poll = fn; return 1; }, clearInterval() {},
    async fetch(_url: string, options: { method?: string; body?: string }) {
      requests.push(options);
      if (options.method === "POST") return { ok: control.postOk };
      return { ok: control.getOk, json: async () => ({ exercise: "keypad", admission: control.automatic ? "automatic_once" : "manual", windowOpen: control.windowOpen, deletionPending: 0, runs: control.empty ? [] : [{
        id: "00000000-0000-4000-8000-000000000001", stage: control.pending ? "pending" : "ended", digits: [], terminalObserved: !control.pending,
        pending: control.pending ? { caller: "synthetic", arrivedAt: Date.now(), expiresAt: Date.now() + (control.expired ? -1000 : 20000) } : null,
      }] }) };
    },
  });
  const render = () => { cursor = 0; return nodes(exports.default()); };
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  render(); mounted = true; effects.forEach(fn => fn()); await flush();
  return { control, requests, render, flush, refresh: async () => { poll(); await flush(); },
    click: async () => { render().find(n => n.type === "button" && n.props.children === "This is my Grok test — approve")!.props.onClick!(); await flush(); } };
}

describe("pilot control feedback (synthetic hook harness)", () => {
  it("automatic mode shows waiting or closed status without an approval button", async () => {
    const h = await harness(); h.control.automatic = true; await h.refresh();
    expect(h.render().some(n => n.props.children === "This is my Grok test — approve")).toBe(false);
    h.control.empty = true; await h.refresh();
    expect(h.render().some(n => n.props.children === "Waiting for test call")).toBe(true);
    h.control.windowOpen = false; await h.refresh();
    expect(h.render().some(n => n.props.children === "Admission closed. Wait for GO.")).toBe(true);
  });
  it("retains a failed exact-call approval across successful status polls", async () => {
    const h = await harness(); await h.click(); await h.refresh();
    expect(h.render().some(n => n.props.role === "alert" && String(n.props.children).includes("Action was not confirmed"))).toBe(true);
    expect(JSON.parse(h.requests.find(r => r.method === "POST")!.body!)).toEqual({ action: "approve", runId: "00000000-0000-4000-8000-000000000001" });
  });
  it("retains accepted feedback and separately reports polling failure", async () => {
    const h = await harness(); h.control.postOk = true; await h.click();
    h.control.getOk = false; await h.refresh();
    expect(h.render().some(n => n.props.role === "status" && String(n.props.children).startsWith("Approval accepted."))).toBe(true);
    expect(h.render().some(n => n.props.role === "alert" && String(n.props.children).includes("sign-in"))).toBe(true);
    h.control.getOk = true; await h.refresh();
    expect(h.render().some(n => n.props.role === "status" && String(n.props.children).startsWith("Approval accepted."))).toBe(true);
  });
  it("disables expired approval and removes approval for ended calls", async () => {
    const h = await harness(); h.control.expired = true; await h.refresh();
    expect(h.render().find(n => n.props.children === "This is my Grok test — approve")!.props.disabled).toBe(true);
    h.control.pending = false; await h.refresh();
    expect(h.render().some(n => n.props.children === "This is my Grok test — approve")).toBe(false);
  });
});
