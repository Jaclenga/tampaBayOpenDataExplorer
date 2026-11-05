import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { parseCatalog } from "../src/services/catalog";

const temporaryRoots: string[] = [];
const entry = {
  id: "parks",
  title: "Neighborhood parks",
  description: "Local parks",
  jurisdiction: "test",
  publisher: "Test City",
  service_url: "https://data.example.test/Parks/FeatureServer",
  layer_id: 0,
  geometry_type: "esriGeometryPoint",
  verified: "2026-11-04",
  source_url: "https://data.example.test/parks",
  category: "Recreation",
  terms: "Source terms",
  tags: [],
};
function fixture(registry: unknown, schemas: unknown = {}) {
  const root = mkdtempSync(join(tmpdir(), "tbod-tests-"));
  temporaryRoots.push(root);
  const source = join(root, "upstream");
  const extdata = join(source, "inst", "extdata");
  mkdirSync(extdata, { recursive: true });
  writeFileSync(join(extdata, "datasets.json"), JSON.stringify(registry));
  writeFileSync(
    join(extdata, "expected-schemas.json"),
    JSON.stringify(schemas),
  );
  execFileSync("git", ["init", source], { stdio: "pipe" });
  execFileSync("git", ["-C", source, "add", "."], { stdio: "pipe" });
  execFileSync(
    "git",
    [
      "-C",
      source,
      "-c",
      "user.name=Test Fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "Synthetic catalog",
    ],
    { stdio: "pipe" },
  );
  const output = join(root, "output", "catalog.json");
  mkdirSync(join(root, "output"));
  writeFileSync(output, "previous catalog");
  const generate = () =>
    spawnSync(process.execPath, [resolve("scripts/generate-catalog.mjs")], {
      cwd: process.cwd(),
      env: { ...process.env, TBOD_SOURCE: source, TBOD_OUTPUT: output },
      encoding: "utf8",
      timeout: 15000,
    });
  return { output, source, generate };
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const target = resolve(root);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith("tbod-tests-")
    )
      throw new Error(
        `Refusing to clean an unexpected fixture path: ${target}`,
      );
    rmSync(target, { recursive: true, force: true });
  }
});
describe("catalog generator integration with a synthetic local git repository", () => {
  it("writes every source entry, field snapshot and exact upstream commit", () => {
    const { output, source, generate } = fixture(
      [entry, { ...entry, id: "roads", layer_id: 1 }],
      {
        "test/parks": {
          endpoint: `${entry.service_url}/0`,
          geometry_type: entry.geometry_type,
          fields: [{ name: "OID", type: "esriFieldTypeOID" }],
        },
      },
    );
    const result = generate();
    expect(result.status, result.stderr).toBe(0);
    const value = parseCatalog(JSON.parse(readFileSync(output, "utf8")));
    expect(value.datasets.map((d) => d.id)).toEqual([
      "test/parks",
      "test/roads",
    ]);
    expect(value.datasets[0].fields?.[0].name).toBe("OID");
    expect(value.datasets[1].fields).toBeNull();
    expect(value.upstreamCommit).toBe(
      execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
    );
  }, 20000);
  it.each([
    ["empty registry", [], {}],
    ["missing interface field", [{ ...entry, title: undefined }], {}],
    ["duplicate endpoint", [entry, { ...entry, id: "duplicate" }], {}],
    ["schema array", [entry], []],
    ["null schema file", [entry], null],
    ["primitive schema file", [entry], "unexpected schema format"],
    [
      "unrecognized schema key",
      [entry],
      {
        "renamed/parks": {
          endpoint: `${entry.service_url}/0`,
          geometry_type: entry.geometry_type,
          fields: [],
        },
      },
    ],
    [
      "missing schema fields",
      [entry],
      {
        "test/parks": {
          endpoint: `${entry.service_url}/0`,
          geometry_type: entry.geometry_type,
        },
      },
    ],
    [
      "malformed schema fields",
      [entry],
      {
        "test/parks": {
          endpoint: `${entry.service_url}/0`,
          geometry_type: entry.geometry_type,
          fields: "changed interface",
        },
      },
    ],
    [
      "schema endpoint mismatch",
      [entry],
      {
        "test/parks": {
          endpoint: "https://incorrect.example.test/0",
          geometry_type: entry.geometry_type,
        },
      },
    ],
  ])(
    "fails visibly and retains the previous catalog for %s",
    (_name, registry, schemas) => {
      const { output, generate } = fixture(registry, schemas);
      const result = generate();
      expect(result.status).not.toBe(0);
      expect(result.stderr).not.toBe("");
      expect(readFileSync(output, "utf8")).toBe("previous catalog");
    },
    20000,
  );
});
