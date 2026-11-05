import { describe, it, expect } from "vitest";
import {
  acquireBudget,
  emptyBudget,
  releaseBudget,
  type BudgetState,
} from "../../src/server/request-budget";
import policy from "../../config/proxy-budget.json";
describe("shared proxy request budgets", () => {
  it("strictly caps concurrent leases and frees released slots", () => {
    let state: BudgetState | undefined;
    for (let i = 0; i < policy.concurrent; i++) {
      const result = acquireBudget(state, "client", 1000, String(i));
      expect(result.decision.allowed).toBe(true);
      state = result.state;
    }
    expect(acquireBudget(state, "other", 1000, "extra").decision).toEqual({
      allowed: false,
      retryAfter: 1,
    });
    state = releaseBudget(state!, "0");
    expect(acquireBudget(state, "other", 1000, "extra").decision.allowed).toBe(
      true,
    );
  });
  it("enforces per-client limits independently of released leases", () => {
    let state = emptyBudget(1000);
    for (let i = 0; i < policy.perClient; i++) {
      const result = acquireBudget(state, "client", 1000, String(i));
      expect(result.decision.allowed).toBe(true);
      state = releaseBudget(result.state, String(i));
    }
    expect(acquireBudget(state, "client", 1000, "blocked").decision).toEqual({
      allowed: false,
      retryAfter: 59,
    });
    expect(acquireBudget(state, "other", 1000, "ok").decision.allowed).toBe(
      true,
    );
  });
  it("enforces the global limit across distinct clients", () => {
    let state = emptyBudget(1000);
    for (let i = 0; i < policy.global; i++) {
      const result = acquireBudget(state, "client" + i, 1000, String(i));
      state = releaseBudget(result.state, String(i));
    }
    expect(
      acquireBudget(state, "another", 1000, "blocked").decision.allowed,
    ).toBe(false);
  });
  it("expires abandoned leases and resets counters without dropping live leases", () => {
    const original = acquireBudget(undefined, "client", 1000, "expired").state;
    expect(
      acquireBudget(original, "other", 1000 + policy.leaseMs, "new").state
        .leases,
    ).toEqual({ new: 1000 + 2 * policy.leaseMs });
    const active = acquireBudget(undefined, "client", 59999, "live").state;
    const next = acquireBudget(active, "other", 60000, "next");
    expect(next.state.count).toBe(1);
    expect(next.state.clients).toEqual({ other: 1 });
    expect(next.state.leases.live).toBeDefined();
    expect(original.leases).toEqual({ expired: 1000 + policy.leaseMs });
  });
});
