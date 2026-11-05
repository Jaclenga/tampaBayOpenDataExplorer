import { z } from "zod";
import { requestJson } from "../http";
import { compileFilter } from "../record-filter";
import type { SourceAdapter, PageRequest } from "./types";
import type { Dataset } from "../../types";
import { resource, plainMetadata, plainPage, pageLimits } from "./common";
const responseSchema = z.object({
  success: z.literal(true),
  result: z.object({
    fields: z.array(z.object({ id: z.string(), type: z.string() })),
    records: z.array(z.record(z.string(), z.unknown())),
    total: z.number().int().nonnegative(),
  }),
});
async function query(dataset: Dataset, request: PageRequest) {
  const source = resource(dataset);
  if (!source.apiRoot || !source.id)
    throw Error("CKAN DataStore resource configuration is missing.");
  const url = new URL(
    `${source.apiRoot.replace(/\/$/, "")}/api/3/action/datastore_search`,
  );
  const { offset, limit } = pageLimits(request);
  url.search = new URLSearchParams({
    resource_id: source.id,
    offset: String(offset),
    limit: String(limit),
    sort: "_id asc",
  }).toString();
  return responseSchema.parse(await requestJson(url.href, request.signal))
    .result;
}
export const ckanAdapter: SourceAdapter = {
  id: "ckan",
  async inspect(dataset, signal) {
    const result = await query(dataset, { limit: 1, signal });
    return plainMetadata(
      result.fields.map((field) => ({ name: field.id, type: field.type })),
      {
        objectIdField: result.fields.some((f) => f.id === "_id") ? "_id" : null,
        orderBy: true,
        filterOperators: ["eq"],
      },
    );
  },
  async page(dataset, metadata, request) {
    const { offset, limit } = pageLimits(request);
    if (request.filter) {
      compileFilter(request.filter, metadata.fields);
      if (request.filter.operator !== "eq")
        throw Error("CKAN supports equality filters in this preview.");
    }
    const source = resource(dataset);
    const url = new URL(`${source.apiRoot}/api/3/action/datastore_search`);
    url.search = new URLSearchParams({
      resource_id: source.id!,
      offset: String(offset),
      limit: String(limit),
      sort: "_id asc",
    }).toString();
    if (request.filter)
      url.searchParams.set(
        "filters",
        JSON.stringify({
          [request.filter.field]: /int|numeric|number|float|double/i.test(
            metadata.fields.find(
              (field) => field.name === request.filter!.field,
            )!.type,
          )
            ? Number(request.filter.value)
            : request.filter.value,
        }),
      );
    const result = responseSchema.parse(
      await requestJson(url.href, request.signal),
    ).result;
    if (result.records.length > limit)
      throw Error("CKAN ignored the record limit.");
    return plainPage(
      result.records,
      offset,
      limit,
      offset + result.records.length < result.total,
      "Live source results may change between pages. Map previews are unavailable for this adapter.",
      metadata.objectIdField
        ? { field: metadata.objectIdField, previousIds: request.previousIds }
        : undefined,
    );
  },
};
