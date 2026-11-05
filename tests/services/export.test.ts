import { describe, expect, it, vi } from "vitest";
import { csv, download, geojson } from "../../src/services/export";
import { normalizeGeometry } from "../../src/services/arcgis";
import type { Page } from "../../src/types";
import { fields, record } from "../fixtures";

describe("lossless loaded-page exports", () => {
  it("preserves negative numeric values instead of treating them as formulas", () => {
    expect(csv([{ attributes: { VALUE: -82.45 } }], [])).toBe(
      '\uFEFF"VALUE"\r\n"-82.45"',
    );
  });
  it.each(["=1+1", "+SUM(A1)", "-SUM(A1)", "@SUM(A1)", "\t=1+1", "  =1+1"])(
    "neutralizes untrusted formula text %j",
    (value) => {
      expect(csv([{ attributes: { NAME: value } }], [])).toContain(
        `"'${value}"`,
      );
    },
  );
  it("retains zero, false, Unicode and unexpected primitive fields", () => {
    const text = csv(
      [
        {
          attributes: {
            COUNT: 0,
            OPEN: false,
            NAME: "José 🌴",
            UNKNOWN: "extra",
          },
        },
      ],
      [],
    );
    expect(text).toContain('"0","false","José 🌴","extra"');
    expect(text).toContain('"UNKNOWN"');
  });
  it("retains headers for an empty dataset", () => {
    expect(csv([], fields)).toBe('\uFEFF"OBJECTID","NAME","VALUE"');
  });
  it("creates a downloadable blob and releases its object URL", async () => {
    vi.useFakeTimers();
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    download("test data", "page.csv", "text/csv");
    expect(anchor).toMatchObject({ href: "blob:test", download: "page.csv" });
    expect(anchor.click).toHaveBeenCalledOnce();
    const blob = create.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(await (blob as Blob).text()).toBe("test data");
    expect(revoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:test");
  });
  it("exports exactly the loaded page without dropping null geometry or properties", () => {
    const records = [
      record(7),
      { attributes: { OBJECTID: 8, NAME: null }, geometry: null },
    ];
    const page: Page = {
      records,
      geojson: normalizeGeometry(records, true, { wkid: 4326 }),
      hasMore: true,
      offset: 6,
      limit: 2,
      warning: null,
    };
    const result = JSON.parse(geojson(page));
    expect(result.features).toHaveLength(2);
    expect(result.features[1]).toMatchObject({
      geometry: null,
      properties: { OBJECTID: 8, NAME: null },
    });
    expect(result.features[0].geometry.coordinates).toEqual([
      records[0].geometry!.x,
      records[0].geometry!.y,
    ]);
  });
});
