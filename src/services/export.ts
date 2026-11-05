import type { Field, Page } from "../types";
export function csv(records: Page["records"], fields: Field[]) {
  const columns = [
    ...new Set([
      ...fields.map((f) => f.name),
      ...records.flatMap((r) => Object.keys(r.attributes)),
    ]),
  ];
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
      text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      columns.map(cell).join(","),
      ...records.map((r) =>
        columns.map((k) => cell(r.attributes[k])).join(","),
      ),
    ].join("\r\n")
  );
}
export function geojson(page: Page) {
  if (!page.geojson)
    throw Error("WGS84 spatial data is unavailable for this page.");
  return JSON.stringify(page.geojson, null, 2);
}
export function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
