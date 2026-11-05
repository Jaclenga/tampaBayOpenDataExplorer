import { describe, expect, it } from "vitest";
import {
  geometryLabel,
  datasetMetadata,
  catalogAccessStatus,
} from "../../src/services/catalog-presentation";
import { dataset } from "../fixtures";
describe("catalog row presentation", () => {
  it.each([
    ["esriGeometryPoint", "Point layer"],
    ["esriGeometryMultipoint", "Multipoint layer"],
    ["esriGeometryPolyline", "Line layer"],
    ["esriGeometryPolygon", "Polygon layer"],
    ["none", "Table"],
    ["unknown", "Dataset"],
    [null, "Dataset"],
    [undefined, "Dataset"],
  ])("labels geometry %s from metadata", (type, label) =>
    expect(geometryLabel(type)).toBe(label),
  );
  it("joins only available metadata without guessing from the title", () => {
    expect(
      datasetMetadata({
        ...dataset,
        category: null,
        geometryType: "esriGeometryPolygon",
      }),
    ).toBe("Test City \u00b7 Polygon layer");
    expect(
      datasetMetadata({
        ...dataset,
        publisher: " ",
        category: "",
        geometryType: "none",
      }),
    ).toBe("Table");
    expect(datasetMetadata(dataset)).toBe(
      "Test City \u00b7 Recreation \u00b7 Point layer",
    );
  });
  it.each(["HTTP 503", "HTTP 404: Not Found", "HTTP 410", "Request timed out"])(
    "preserves known failed source checks: %s",
    (reason) => expect(catalogAccessStatus(reason)?.failed).toBe(true),
  );
  it.each([
    "Publisher blocked browser access.",
    "ArcGIS 499: Token required",
    "Unsupported preview format",
  ])(
    "does not label a preview/access limitation as a broken source: %s",
    (reason) => expect(catalogAccessStatus(reason)?.failed).toBe(false),
  );
  it("has no invented failure for unreported status", () =>
    expect(catalogAccessStatus(null)).toBeNull());
});
