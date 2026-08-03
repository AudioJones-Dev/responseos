const payload = JSON.parse(process.env.MOCK_GITHUB_RESPONSE ?? "[]");

globalThis.fetch = async () =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
