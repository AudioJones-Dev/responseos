import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import AuditPage from "@/app/(marketing)/audit/page";

const FLAG = "RESPONSEOS_PUBLIC_AUDIT_INTAKE_ENABLED";

function render(): string {
  return renderToStaticMarkup(createElement(AuditPage));
}

// With intake off, /api/audit-requests is not a public path, so a submitted
// form is redirected to sign-in and the lead is lost. The page must not offer
// the form unless the API will accept it.
describe("/audit intake gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("intake off: no form, a working email path instead", () => {
    vi.stubEnv(FLAG, "");
    const html = render();
    expect(html).not.toContain("<form");
    expect(html).toContain("mailto:hello@responseos.pro?subject=");
    expect(html).toContain("Online requests are not open yet");
  });

  test("any value other than \"true\" counts as off", () => {
    vi.stubEnv(FLAG, "TRUE");
    expect(render()).not.toContain("<form");
  });

  test("intake on: the form is rendered and the email fallback is not", () => {
    vi.stubEnv(FLAG, "true");
    const html = render();
    expect(html).toContain("<form");
    expect(html).not.toContain("mailto:hello@responseos.pro");
  });
});
