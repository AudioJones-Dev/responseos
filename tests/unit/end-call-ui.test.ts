import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { EndCallControls } from "@/app/(admin)/admin/demo-operations/EndCallControls";
import { ConsentControls } from "@/app/(admin)/admin/demo-operations/ConsentControls";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const target={captureId:'capture-exact',expectedAccountId:'account-exact',expectedProviderCallId:'call-exact',generation:3};
test('End call distinguishes acceptance from evidence and uses server eligibility', () => {
  const pending=renderToStaticMarkup(createElement(EndCallControls,{target,confirmed:false,eligibility:{allowed:true,reason:"fresh_exact_active_evidence"}}));
  expect(pending).toContain('>End call</button>'); expect(pending).not.toContain('disabled=""');
  expect(pending).toContain('Command acceptance is not confirmed disconnection');
  expect(pending).toContain('Refresh disconnection evidence');
  expect(renderToStaticMarkup(createElement(EndCallControls,{target,confirmed:true,eligibility:{allowed:false,reason:"disconnection_confirmed"}}))).toMatch(/disabled="">End call/);
});
test('withdrawn or closed capture never offers enabled grant or refusal', () => {
  const html=renderToStaticMarkup(createElement(ConsentControls,{id:target.captureId,callReference:target.expectedProviderCallId,terminal:true}));
  expect(html).toMatch(/disabled="">Record grant/); expect(html).toMatch(/disabled="">Record refuse/);
  expect(html).toContain('>Retry withdrawal (may send AI stop)</button>');
});

test('ineligible controls explain independent carrier fallback and visibly disable consent', () => {
  const html=renderToStaticMarkup(createElement(EndCallControls,{target,confirmed:false,eligibility:{allowed:false,reason:'lifecycle_ended'}}));
  expect(html).toContain('Operator fallback: do not retry');
  expect(html).toContain('Carrier console capabilities have not been verified');
  expect(html).toContain('call-exact');
  expect(html).toMatch(/disabled="">End call/);
  expect(renderToStaticMarkup(createElement(ConsentControls,{id:'c',callReference:'call',terminal:true}))).toContain('disabled:opacity-40');
});
test('recorded disconnection disables End call without offering a carrier fallback', () => {
  const html=renderToStaticMarkup(createElement(EndCallControls,{target,confirmed:false,disconnectedAt:'2026-10-19T00:00:00.000Z',eligibility:{allowed:true,reason:'fresh_exact_active_evidence'}}));
  expect(html).toMatch(/disabled="">End call/);
  expect(html).not.toContain('Operator fallback');
});
