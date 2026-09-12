import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { request } from "node:https";
import type { RequestOptions } from "node:https";
import { afterEach, expect, test, vi } from "vitest";
import { acquireProspectWebsite, MAX_PROSPECT_PAGE_BYTES, PROSPECT_FETCH_TIMEOUT_MS } from "@/lib/prospectBootstrap/websiteAcquisition";

vi.mock("node:https", () => ({ request: vi.fn() }));

const address = { address: "93.184.216.34", family: 4 };
const lookupFn = async () => [address];
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

test.each([true, false])("native transport honors lookup all=%s and pins the validated address", async (all) => {
  vi.mocked(request).mockImplementation(((_url: URL, options: RequestOptions, respond: (response: Readable) => void) => {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
      end() {
        const callback = vi.fn();
        options.lookup!("example.com", { all }, callback);
        expect(callback.mock.calls).toEqual([all ? [null, [address]] : [null, address.address, 4]]);
        respond(Object.assign(Readable.from([Buffer.from("Public business information")]), {
          statusCode: 200, headers: { "content-type": "text/plain" },
        }));
      },
    });
  }) as typeof request);
  const result = await acquireProspectWebsite({ canonicalUrl: "https://example.com", lookupFn });
  expect(result.pages).toHaveLength(1);
  expect(result.pages[0].extractedText).toBe("Public business information");
  expect(request).toHaveBeenCalledTimes(2);
});

test.each(["robots", "page"])("aborts a stalled %s body after the request deadline", async (stalled) => {
  vi.useFakeTimers();
  let aborted = false;
  const fetchFn = vi.fn<typeof fetch>(async (url, init) => {
    const robots = String(url).endsWith("/robots.txt");
    if (robots && stalled === "page") return new Response("");
    return new Response(new ReadableStream({
      start(controller) {
        init!.signal!.addEventListener("abort", () => {
          aborted = true;
          controller.error(new Error("body_deadline"));
        }, { once: true });
      },
    }), { headers: { "content-type": "text/plain" } });
  });
  const outcome = acquireProspectWebsite({ canonicalUrl: "https://example.com", lookupFn, fetchFn })
    .then((result) => result.blockedUrls[0]?.reason, (error: Error) => error.message);
  await vi.advanceTimersByTimeAsync(PROSPECT_FETCH_TIMEOUT_MS);
  expect(aborted).toBe(true);
  expect(await outcome).toBe("body_deadline");
  expect(vi.getTimerCount()).toBe(0);
});

test("cancels a redirect body before requesting the next URL", async () => {
  const cancel = vi.fn();
  const fetchFn = vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith("/robots.txt")) return new Response("");
    if (String(url) === "https://example.com/") {
      return new Response(new ReadableStream({ cancel }), { status: 302, headers: { location: "/about" } });
    }
    expect(cancel).toHaveBeenCalledOnce();
    return new Response("About", { headers: { "content-type": "text/plain" } });
  });
  const result = await acquireProspectWebsite({ canonicalUrl: "https://example.com", lookupFn, fetchFn });
  expect(result.pages[0].url).toBe("https://example.com/about");
});

test.each(["oversized", "stalled"])("ignores and cancels an %s robots 404 body", async (bodyKind) => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const fetchFn = vi.fn<typeof fetch>(async (url, init) => {
    if (!String(url).endsWith("/robots.txt")) {
      return new Response("Business information", { headers: { "content-type": "text/plain" } });
    }
    return new Response(new ReadableStream({
      start(controller) {
        if (bodyKind === "oversized") controller.enqueue(new Uint8Array(MAX_PROSPECT_PAGE_BYTES + 1));
        init!.signal!.addEventListener("abort", () => controller.error(new Error("body_deadline")), { once: true });
      },
      cancel,
    }), { status: 404 });
  });
  const outcome = acquireProspectWebsite({ canonicalUrl: "https://example.com", lookupFn, fetchFn })
    .then((result) => result, (error: Error) => error.message);
  await vi.advanceTimersByTimeAsync(PROSPECT_FETCH_TIMEOUT_MS);
  expect(await outcome).toMatchObject({ pages: [{ extractedText: "Business information" }], blockedUrls: [] });
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
