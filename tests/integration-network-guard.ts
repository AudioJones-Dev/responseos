import { afterEach, beforeEach, expect } from "vitest";
let blocked = 0;
const deny = (() => { blocked++; throw new Error("integration_network_forbidden"); }) as typeof fetch;
globalThis.fetch = deny;
beforeEach(() => { blocked = 0; globalThis.fetch = deny; });
afterEach(() => { expect(blocked, "Unexpected real fetch attempt blocked by integration boundary").toBe(0); });
