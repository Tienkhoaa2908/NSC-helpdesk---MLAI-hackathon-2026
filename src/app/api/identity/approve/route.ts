export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Kept as a safe landing route for old notification links. A GET must never
// approve, reject, or issue an account because email scanners follow links.
export async function GET() {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/identity/review",
      "cache-control": "no-store, max-age=0",
      "referrer-policy": "no-referrer",
    },
  });
}
