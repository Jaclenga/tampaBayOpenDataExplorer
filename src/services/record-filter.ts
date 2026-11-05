import type { Field } from "../types";

export interface RecordFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "is-null";
  value: string;
}
const operators = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
export function compileFilter(
  filter: RecordFilter | undefined,
  fields: Field[],
) {
  if (!filter) return "1=1";
  const field = fields.find((field) => field.name === filter.field);
  if (!field || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(field.name))
    throw Error("Select a valid field from the current source schema.");
  if (filter.operator === "is-null") return `${field.name} IS NULL`;
  if (filter.value.length > 300)
    throw Error("Filter values must be 300 characters or fewer.");
  if (/Date|Geometry|Blob|Raster/i.test(field.type))
    throw Error("Filtering this field type is not supported.");
  const numeric =
    /OID|Integer|Double|Single|SmallInteger|numeric|number|float|int[248]/i.test(
      field.type,
    );
  if (filter.operator === "contains") {
    if (numeric || /[%_]/.test(filter.value))
      throw Error("Contains requires text without wildcard characters.");
    return `${field.name} LIKE '%${filter.value.replace(/'/g, "''")}%'`;
  }
  const operator = operators[filter.operator];
  if (!operator) throw Error("Unsupported filter operator.");
  if (numeric) {
    if (
      !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(filter.value) ||
      !Number.isFinite(Number(filter.value))
    )
      throw Error("Enter a finite numeric filter value.");
    return `${field.name} ${operator} ${Number(filter.value)}`;
  }
  return `${field.name} ${operator} '${filter.value.replace(/'/g, "''")}'`;
}
