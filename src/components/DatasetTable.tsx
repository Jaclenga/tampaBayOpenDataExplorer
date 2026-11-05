import { useMemo, useState } from "react";
import type { Field, RecordFeature } from "../types";
export default function DatasetTable({
  records,
  fields,
}: {
  records: RecordFeature[];
  fields: Field[];
}) {
  const [sort, setSort] = useState<{ key: string; ascending: boolean } | null>(
    null,
  );
  const rows = useMemo(
    () =>
      sort
        ? [...records].sort((a, b) => {
            const x = a.attributes[sort.key],
              y = b.attributes[sort.key];
            const n =
              typeof x === "number" && typeof y === "number"
                ? x - y
                : String(x ?? "").localeCompare(String(y ?? ""));
            return sort.ascending ? n : -n;
          })
        : records,
    [records, sort],
  );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label="Dataset records, scroll horizontally"
    >
      <table>
        <caption>Loaded records · column sorting applies to this page</caption>
        <thead>
          <tr>
            {fields.map((f) => (
              <th
                key={f.name}
                aria-sort={
                  sort?.key === f.name
                    ? sort.ascending
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  onClick={() =>
                    setSort({
                      key: f.name,
                      ascending: sort?.key === f.name ? !sort.ascending : true,
                    })
                  }
                >
                  {f.alias || f.name} <span aria-hidden="true">↕</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {fields.map((f) => (
                <td key={f.name}>
                  {r.attributes[f.name] === null ||
                  r.attributes[f.name] === undefined ? (
                    <span className="muted">—</span>
                  ) : (
                    String(r.attributes[f.name])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="empty">No records found in this preview.</p>
      )}
    </div>
  );
}
