import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { EndCallControls } from "@/app/(admin)/admin/demo-operations/EndCallControls";
import { ConsentControls } from "@/app/(admin)/admin/demo-operations/ConsentControls";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const target={captureId:'capture-exact',expectedAccountId:'account-exact',expectedProviderCallId:'call-exact',generation:3};
test('End call distinguishes acceptance from evidence and disables only confirmed disconnection', () => {
  const pending=renderToStaticMarkup(createElement(EndCallControls,{target,confirmed:false}));
  expect(pending).toContain('>End call</button>'); expect(pending).not.toContain('disabled=""');
  expect(pending).toContain('Command acceptance is not confirmed disconnection');
  expect(pending).toContain('Refresh disconnection evidence');
  expect(renderToStaticMarkup(createElement(EndCallControls,{target,confirmed:true}))).toMatch(/disabled="">End call/);
});
test('withdrawn or closed capture never offers enabled grant or refusal', () => {
  const html=renderToStaticMarkup(createElement(ConsentControls,{id:target.captureId,callReference:target.expectedProviderCallId,terminal:true}));
  expect(html).toMatch(/disabled="">Record grant/); expect(html).toMatch(/disabled="">Record refuse/);
  expect(html).toContain('>Record withdraw</button>');
});
