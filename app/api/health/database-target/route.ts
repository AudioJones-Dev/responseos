import {
  describeDatabaseTarget,
  isAuthorizedDiagnosticRequest,
} from "@/lib/diagnostics/database-target";

// Token-gated, read-only report of the hostname and database name in this
// deployment's DATABASE_URL. Disabled (404) unless
// RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256 is set. Removal plan:
// docs/database/production-target-check.md.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Robots-Tag": "noindex, nofollow",
};

// Disabled and unauthorized requests get the same response, so a caller
// without the token cannot tell whether the check is switched on.
function notFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  if (
    !isAuthorizedDiagnosticRequest(
      request.headers.get("authorization"),
      process.env.RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256,
    )
  ) {
    return notFound();
  }

  return Response.json(
    {
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      deployment_url: process.env.VERCEL_URL ?? null,
      environment: process.env.VERCEL_ENV ?? "local",
      build_sha: process.env.RESPONSEOS_BUILD_SHA ?? "local",
      runtime_git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      database_url: describeDatabaseTarget(process.env.DATABASE_URL),
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
