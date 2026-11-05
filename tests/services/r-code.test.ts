import { describe, it, expect } from "vitest";
import curated from "../../public/catalog.json";
import discovered from "../../public/discovery.json";
import { parseCatalog } from "../../src/services/catalog";
import { discoverySchema } from "../../src/services/discovery/types";
import { rExample, rString } from "../../src/services/r-code";
import type { Dataset } from "../../src/types";
const checked = parseCatalog(curated).datasets;
const layers = discoverySchema.parse(discovered).datasets;
const permits = checked.find((d) => d.id === "tampa/construction-permits")!;
const hart = layers.find((d) => d.title === "HART Stops")!;
function code(dataset: Dataset, options: Parameters<typeof rExample>[1] = {}) {
  const result = rExample(dataset, options);
  expect(result.supported).toBe(true);
  if (!result.supported) throw Error(result.reason);
  return result.code;
}

describe("R examples from real checked and discovered metadata", () => {
  it("uses the real package ID instead of the website route ID", () => {
    expect(permits).toBeTruthy();
    const value = code(permits);
    expect(value).toContain(
      'tbod_get_dataset("construction-permits", limit = 100)',
    );
    expect(value).not.toContain('"tampa/construction-permits"');
    expect(value).toContain('install.packages("tampaBayOpenData")');
    expect(value).toContain("library(tampaBayOpenData)");
    expect(value).toContain("head(data)");
    expect(value).toContain("str(data)");
    expect(value).not.toContain("limit = Inf");
  });
  it("recognizes every real curated entry without inventing identifiers", () => {
    for (const d of checked) {
      const result = rExample(d);
      expect(result.supported, d.id).toBe(true);
      if (result.supported) {
        expect(result.checked, d.id).toBe(true);
        expect(result.code).toContain(
          `tbod_get_dataset(${rString(d.packageId)}, limit = 100)`,
        );
      }
    }
  });
  it("uses the complete original layer URL for a real discovery", () => {
    expect(hart).toBeTruthy();
    const value = code(hart);
    expect(value).toContain(
      `tbod_get_arcgis_layer(${rString(hart.serviceUrl + "/" + hart.layerId)}, limit = 100)`,
    );
    expect(value).not.toContain(hart.id);
    expect(value).not.toContain("/api/arcgis");
  });
  it("handles a real MapServer discovery", () => {
    const d = layers.find(
      (d) => d.serviceUrl?.endsWith("/MapServer") && d.queryable !== false,
    )!;
    expect(d).toBeTruthy();
    expect(code(d)).toContain(`${d.serviceUrl}/${d.layerId}`);
  });
  it("supports spatial previews and full retrieval independently", () => {
    const value = code(hart, { spatial: true });
    expect(value).toContain("limit = 100, spatial = TRUE");
    expect(value).toContain('install.packages("sf")');
    expect(value).toContain("sf::st_geometry(data)");
    expect(code(permits, { full: true })).toContain(
      'tbod_get_dataset("construction-permits", limit = Inf)',
    );
    expect(code(hart, { full: true, spatial: true })).toContain(
      "limit = Inf, spatial = TRUE",
    );
  });
  it("does not offer sf for a real nonspatial layer", () => {
    const d = layers.find(
      (d) => d.geometryType === "none" && d.queryable !== false,
    )!;
    expect(d).toBeTruthy();
    expect(rExample(d)).toMatchObject({
      supported: true,
      spatialAvailable: false,
    });
    expect(code(d, { spatial: true })).not.toContain("spatial = TRUE");
    expect(code(d, { spatial: true })).not.toContain('"sf"');
  });
  it("does not infer checked package support from an untrusted status or ID", () => {
    expect(code({ ...hart, validationStatus: "curated" })).toContain(
      "tbod_get_arcgis_layer",
    );
    expect(code({ ...permits, packageId: "invented-id" })).toContain(
      "tbod_get_arcgis_layer",
    );
    expect(code({ ...permits, layerId: 99 })).toContain(
      "tbod_get_arcgis_layer",
    );
    expect(code({ ...permits, validationStatus: "discovered" })).toContain(
      "tbod_get_arcgis_layer",
    );
  });
  it.each(["ckan", "socrata", "csv", "json"] as const)(
    "does not assume %s resources are supported by the R package",
    (platform) => {
      expect(
        rExample({
          ...hart,
          platform,
          resource: { url: "https://example.gov/file" },
        }),
      ).toMatchObject({
        supported: false,
        reason: expect.stringContaining("not supported"),
      });
    },
  );
  it("clearly rejects a source that disables queries", () =>
    expect(rExample({ ...hart, queryable: false })).toMatchObject({
      supported: false,
      reason: expect.stringContaining("record-query"),
    }));
  it.each([
    null,
    "http://arcgis.tampagov.net/arcgis/rest/services/Planning/PermitsAll/FeatureServer",
    "https://user:pass@arcgis.tampagov.net/arcgis/rest/services/Planning/PermitsAll/FeatureServer",
    "https://127.0.0.1/services/FeatureServer",
    "https://localhost/services/FeatureServer",
    "https://evil.test/services/FeatureServer",
    "https://arcgis.tampagov.net/arcgis/rest/services/Planning/PermitsAll/FeatureServer?token=secret",
    "https://arcgis.tampagov.net/arcgis/rest/services/Planning/PermitsAll/FeatureServer#fragment",
    "https://arcgis.tampagov.net/arcgis/rest/services/A/ImageServer",
    "https://arcgis.tampagov.net/arcgis/rest/services/A%2f..%2fFeatureServer",
    "https://arcgis.tampagov.net/arcgis/rest/services/A\\B/FeatureServer",
    "https://arcgis.tampagov.net/arcgis/rest/services/A\nB/FeatureServer",
  ])("rejects invalid or unregistered endpoints %s", (serviceUrl) =>
    expect(rExample({ ...permits, serviceUrl })).toMatchObject({
      supported: false,
    }),
  );
  it.each([null, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid layer ID %s",
    (layerId) =>
      expect(rExample({ ...permits, layerId })).toMatchObject({
        supported: false,
      }),
  );
  it("never puts titles, descriptions or discovery package IDs into executable code", () => {
    expect(
      rExample({
        ...hart,
        serviceUrl: hart.serviceUrl!.replace(
          "/FeatureServer",
          "/\ud800/FeatureServer",
        ),
      }),
    ).toMatchObject({ supported: false });
    expect(
      rExample({
        ...hart,
        serviceUrl: hart.serviceUrl!.replace(
          "/FeatureServer",
          "/" + "x".repeat(2048) + "/FeatureServer",
        ),
      }),
    ).toMatchObject({ supported: false });
    const malicious = '"; system("bad"); #\n';
    expect(
      code({
        ...hart,
        title: malicious,
        description: malicious,
        packageId: malicious,
        publisher: malicious,
      }),
    ).toBe(code(hart));
  });
});
describe("R string escaping", () => {
  it("encodes quotes, backslashes, line breaks and control characters", () => {
    expect(rString('"; system("bad") #')).toBe('"\\"; system(\\"bad\\") #"');
    expect(rString("a\\b\n\r\t")).toBe('"a\\\\b\\u000a\\u000d\\u0009"');
    expect(rString("\u007f")).toBe('"\\u007f"');
  });
  it("preserves Unicode using valid R escapes and rejects invalid R strings", () => {
    expect(rString("é😀")).toBe('"\\u00e9\\U0001f600"');
    expect(() => rString("\0")).toThrow("Invalid");
    expect(() => rString("\ud800")).toThrow("Invalid");
  });
});
