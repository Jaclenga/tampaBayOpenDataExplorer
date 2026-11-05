const legacyOrigin = "https://tampabay-open-data-explorer.pages.dev";
const siteOrigin = "https://tbdataexplorer.pages.dev";

export function legacySiteRedirect(request: Request) {
  const url = new URL(request.url);
  if (url.origin !== legacyOrigin) return null;
  const target = new URL(siteOrigin);
  target.pathname = url.pathname;
  target.search = url.search;
  return Response.redirect(target.href, 308);
}
