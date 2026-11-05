import { describe, expect, it } from "vitest";
import {
  catalogStatus,
  coverageLabel,
  groupedIssues,
  publisherLastCheck,
  publisherName,
  staleAfterHours,
} from "../../src/services/catalog-status";
import { emptyDiscovery } from "../discovery-fixture";
import { dataset } from "../fixtures";
import type {
  DiscoveryReport,
  PortalRun,
} from "../../src/services/discovery/types";
const now = Date.parse("2026-11-05T12:00:00Z");
const run: PortalRun = {
  portalId: "city",
  startedAt: "2026-11-05T10:00:00Z",
  finishedAt: "2026-11-05T11:00:00Z",
  complete: true,
  itemsScanned: 20,
  layersInspected: 24,
  datasetsFound: 23,
  totalItems: 20,
  nextStart: -1,
  issues: [],
};
const healthy: DiscoveryReport = {
  ...emptyDiscovery,
  generatedAt: "2026-11-05T11:30:00Z",
  lastSuccessfulRunAt: run.finishedAt,
  complete: true,
  runs: [run],
  refresh: {
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    outcome: "success",
    verified: 23,
    curatedErrors: 0,
    changes: { added: [], updated: [], retained: 0 },
  },
};
describe("catalog status presentation", () => {
  it("uses successful verification metadata, not generation times or dataset totals", () => {
    expect(catalogStatus(healthy, null, now)).toMatchObject({
      state: "Healthy",
      successfulAt: run.finishedAt,
      attemptedAt: run.startedAt,
      verified: 23,
      publishers: 1,
      issues: 0,
    });
  });
  it("does not mistake a generated fallback timestamp for verification", () => {
    expect(catalogStatus(emptyDiscovery, null, now)).toMatchObject({
      state: "Unavailable",
      successfulAt: null,
      verified: null,
      attemptedAt: null,
    });
    expect(coverageLabel(emptyDiscovery)).toBe(
      "Discovery coverage unavailable",
    );
  });
  it("requires complete discovery without known issues for a healthy status", () => {
    expect(
      catalogStatus({ ...healthy, complete: false }, null, now).state,
    ).toBe("Partial");
    expect(catalogStatus(healthy, "Bundled fallback", now).state).toBe(
      "Partial",
    );
    expect(
      catalogStatus(
        { ...healthy, refresh: { ...healthy.refresh!, curatedErrors: 1 } },
        null,
        now,
      ).state,
    ).toBe("Partial");
  });
  it("uses actual successful attempt time when an explicit successful timestamp is absent", () => {
    expect(
      catalogStatus({ ...healthy, lastSuccessfulRunAt: null }, null, now)
        .successfulAt,
    ).toBe(run.finishedAt);
  });
  it("keeps failed attempts distinct from retained successful verifications", () => {
    const failed = {
      ...healthy,
      refresh: { ...healthy.refresh!, outcome: "failed" as const, verified: 0 },
    };
    expect(catalogStatus(failed, null, now).state).toBe("Unavailable");
    expect(
      catalogStatus(
        {
          ...failed,
          datasets: [
            { ...dataset, portalId: "city", lastVerifiedAt: run.finishedAt },
          ],
        },
        null,
        now,
      ),
    ).toMatchObject({
      state: "Partial",
      verified: 0,
      successfulAt: run.finishedAt,
    });
  });
  it("marks verification stale only after the configured threshold", () => {
    const boundary = Date.parse(run.finishedAt) + staleAfterHours * 3600000;
    expect(catalogStatus(healthy, null, boundary).state).toBe("Healthy");
    expect(catalogStatus(healthy, null, boundary + 1).state).toBe("Stale");
  });
  it("reports friendly publisher names and last actual check, without inventing one from scan completion", () => {
    expect(publisherName("city")).toBe("City of Tampa");
    expect(publisherName("unknown")).toBe("unknown");
    expect(publisherLastCheck(healthy, "city")).toBeNull();
    expect(
      publisherLastCheck(
        {
          ...healthy,
          datasets: [
            { ...dataset, portalId: "city", lastVerifiedAt: run.finishedAt },
          ],
        },
        "city",
      ),
    ).toBe(run.finishedAt);
  });
  it("groups repeated warnings while retaining exact messages and all distinct endpoints", () => {
    const issue = {
      portalId: "city",
      kind: "security" as const,
      message: "Unregistered service location",
      endpoint: "https://example.test/one",
    };
    const result = groupedIssues({
      ...run,
      issues: [
        issue,
        issue,
        { ...issue, endpoint: "https://example.test/two" },
      ],
    });
    expect(result).toEqual([
      {
        label: "Source configuration needs review",
        message: issue.message,
        count: 3,
        endpoints: [issue.endpoint, "https://example.test/two"],
      },
    ]);
    expect(
      catalogStatus(
        { ...healthy, runs: [{ ...run, issues: [issue] }] },
        null,
        now,
      ).state,
    ).toBe("Partial");
  });
});
