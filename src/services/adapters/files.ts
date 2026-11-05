import { z } from "zod";
import type { SourceAdapter } from "./types";
import type { Dataset } from "../../types";
import { boundedText } from "../bounded-response";
import { resource, plainMetadata, plainPage, pageLimits } from "./common";

// A bounded preview of small files, never a whole-database ingestion path.
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let rowStarted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!isRowEnd(char)) rowStarted = true;
    if (char === '"') {
      const quote = readQuote(text, i, quoted);
      cell += quote.value;
      quoted = quote.quoted;
      i = quote.index;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && isRowEnd(char)) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (rowStarted) rows.push(row);
      row = [];
      cell = "";
      rowStarted = false;
    } else cell += char;
  }
  if (quoted) throw Error("CSV contains an unterminated quoted field.");
  if (rowStarted) {
    row.push(cell);
    rows.push(row);
  }
  return csvObjects(rows);
}
function readQuote(text: string, index: number, quoted: boolean) {
  if (quoted && text[index + 1] === '"')
    return { value: '"', quoted: true, index: index + 1 };
  return { value: "", quoted: !quoted, index };
}
function isRowEnd(char: string) {
  return char === "\n" || char === "\r";
}
function csvObjects(rows: string[][]) {
  const headers = rows.shift()?.map((h) => h.replace(/^\uFEFF/, ""));
  if (
    !headers?.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw Error("CSV field names are missing or duplicated.");
  return rows.map((row) => {
    if (row.length !== headers.length)
      throw Error("CSV row does not match its field schema.");
    return Object.fromEntries(headers.map((h, index) => [h, row[index]]));
  });
}
async function load(dataset: Dataset, signal?: AbortSignal) {
  const response = await fetch(resource(dataset).url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    credentials: "omit",
    redirect: "manual",
  });
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  ) {
    await response.body?.cancel();
    throw Error(
      "Publisher redirects are not followed. Use the original publisher link.",
    );
  }
  if (!response.ok) throw Error(`Publisher returned HTTP ${response.status}.`);
  const text = await boundedText(response, 1048576);
  const rows =
    dataset.platform === "csv"
      ? parseCsv(text)
      : z.array(z.record(z.string(), z.unknown())).parse(JSON.parse(text));
  return {
    rows: rows.slice(0, 1000),
    truncated: rows.length > 1000,
    updated: response.headers.get("Last-Modified"),
  };
}
export const fileAdapter: SourceAdapter = {
  id: "files",
  async inspect(dataset, signal) {
    const { rows, updated } = await load(dataset, signal);
    return plainMetadata(
      Object.keys(rows[0] ?? {}).map((name) => ({ name, type: "string" })),
      {
        sourceUpdatedAt:
          updated && Number.isFinite(Date.parse(updated))
            ? new Date(updated).toISOString()
            : null,
        sourceUpdatedKind: "resource",
        filterOperators: [],
      },
    );
  },
  async page(dataset, _metadata, request) {
    const { offset, limit } = pageLimits(request);
    if (request.filter)
      throw Error(
        "File previews do not support source-side filters. Use the publisher download.",
      );
    const { rows, truncated } = await load(dataset, request.signal);
    return plainPage(
      rows.slice(offset, offset + limit),
      offset,
      limit,
      offset + limit < rows.length,
      `Small-file preview only: 1 MiB / 1,000 rows maximum. ${truncated ? "Results are partial. " : ""}The source file is fetched live for each page.`,
    );
  },
};
