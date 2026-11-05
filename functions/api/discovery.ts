import { latestIndex } from "../../src/server/discovery-index";
export async function onRequest(context: { request: Request }) {
  if (context.request.method !== "GET")
    return new Response("Only GET is supported.", { status: 405 });
  const { report, fallback } = await latestIndex(context.request.signal);
  return Response.json(report, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Catalog-Index": fallback ? "bundled-fallback" : "scheduled-index",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
