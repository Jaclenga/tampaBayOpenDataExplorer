import { useState } from "react";
import type { Field } from "../types";
import type { RecordFilter } from "../services/record-filter";

interface Props {
  fields: Field[];
  filter?: RecordFilter;
  operators?: string[];
  busy: boolean;
  onApply: (filter?: RecordFilter) => void;
}
export default function RecordFilters({
  fields,
  filter,
  operators,
  busy,
  onApply,
}: Props) {
  const [field, setField] = useState("");
  const [operator, setOperator] = useState<RecordFilter["operator"]>("eq");
  const [value, setValue] = useState("");
  if (operators?.length === 0)
    return (
      <p className="muted">
        Source-side filters are unavailable for file previews.
      </p>
    );
  return (
    <details className="record-filters">
      <summary>Filter source records</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onApply({ field, operator, value });
        }}
      >
        <label>
          Record field
          <select
            value={field}
            onChange={(event) => setField(event.target.value)}
          >
            <option value="">Choose a field</option>
            {fields
              .filter((f) => !/Date|Geometry|Blob|Raster/i.test(f.type))
              .map((f) => (
                <option key={f.name} value={f.name}>
                  {f.alias ?? f.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Comparison
          <select
            value={operator}
            onChange={(event) =>
              setOperator(event.target.value as RecordFilter["operator"])
            }
          >
            {Object.entries({
              eq: "Equals",
              ne: "Does not equal",
              contains: "Contains text",
              gt: "Greater than",
              gte: "At least",
              lt: "Less than",
              lte: "At most",
              "is-null": "Is missing",
            })
              .filter(([key]) => !operators || operators.includes(key))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Filter value
          <input
            value={value}
            maxLength={300}
            disabled={operator === "is-null"}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <button className="button secondary" disabled={!field || busy}>
          Apply record filter
        </button>
      </form>
      <p className="muted">
        Applied at the source, before pagination. Available comparisons depend
        on the source platform.
      </p>
      {filter && (
        <p>
          Active record filter: {filter.field}.{" "}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => onApply()}
          >
            Clear record filter
          </button>
        </p>
      )}
    </details>
  );
}
