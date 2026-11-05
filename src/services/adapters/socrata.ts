import { z } from "zod";
import type { SourceAdapter } from "./types";
import { requestJson } from "../http";
import { compileFilter } from "../record-filter";
import { resource, plainMetadata, plainPage, pageLimits } from "./common";
const metadataSchema = z.object({
  columns: z.array(
    z.object({
      fieldName: z.string(),
      name: z.string(),
      dataTypeName: z.string(),
    }),
  ),
  rowsUpdatedAt: z.number().optional(),
});
export const socrataAdapter: SourceAdapter = {
  id: "socrata",
  async inspect(dataset, signal) {
    const source = resource(dataset);
    if (
      !source.apiRoot ||
      !source.id ||
      !/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(source.id)
    )
      throw Error("Invalid Socrata resource configuration.");
    const metadata = metadataSchema.parse(
      await requestJson(
        `${source.apiRoot}/api/views/${source.id}.json`,
        signal,
      ),
    );
    return plainMetadata(
      metadata.columns
        .filter((c) => !c.fieldName.startsWith(":"))
        .map((c) => ({
          name: c.fieldName,
          type: c.dataTypeName,
          alias: c.name,
        })),
      {
        orderBy: true,
        sourceUpdatedAt: metadata.rowsUpdatedAt
          ? new Date(metadata.rowsUpdatedAt * 1000).toISOString()
          : null,
        sourceUpdatedKind: "records",
      },
    );
  },
  async page(dataset, metadata, request) {
    const { offset, limit } = pageLimits(request);
    const url = new URL(resource(dataset).url);
    url.search = new URLSearchParams({
      $limit: String(limit),
      $offset: String(offset),
      $order: ":id",
    }).toString();
    if (request.filter)
      url.searchParams.set(
        "$where",
        compileFilter(request.filter, metadata.fields),
      );
    const rows = z
      .array(z.record(z.string(), z.unknown()))
      .parse(await requestJson(url.href, request.signal));
    if (rows.length > limit) throw Error("Socrata ignored the record limit.");
    return plainPage(
      rows,
      offset,
      limit,
      rows.length === limit,
      "Live source results may change between pages. Map previews are unavailable for this adapter.",
    );
  },
};
