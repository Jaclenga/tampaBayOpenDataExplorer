import { legacySiteRedirect } from "../src/server/site-redirect";
export const onRequest: PagesFunction<PagesEnv> = (context) =>
  legacySiteRedirect(context.request) ?? context.next();
