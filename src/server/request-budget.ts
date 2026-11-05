import policy from "../../config/proxy-budget.json";
export interface BudgetState {
  window: number;
  count: number;
  clients: Record<string, number>;
  leases: Record<string, number>;
}
export type Admission =
  { allowed: true; token: string } | { allowed: false; retryAfter: number };
export function emptyBudget(now: number): BudgetState {
  return {
    window: Math.floor(now / policy.windowMs),
    count: 0,
    clients: {},
    leases: {},
  };
}
export function acquireBudget(
  previous: BudgetState | undefined,
  client: string,
  now: number,
  token: string,
): { state: BudgetState; decision: Admission } {
  const state = previous ? structuredClone(previous) : emptyBudget(now);
  const window = Math.floor(now / policy.windowMs);
  if (state.window !== window) {
    state.window = window;
    state.count = 0;
    state.clients = {};
  }
  state.leases = Object.fromEntries(
    Object.entries(state.leases).filter(([, expires]) => expires > now),
  );
  if (
    state.count >= policy.global ||
    (state.clients[client] ?? 0) >= policy.perClient
  )
    return {
      state,
      decision: {
        allowed: false,
        retryAfter: Math.max(
          1,
          Math.ceil(((window + 1) * policy.windowMs - now) / 1000),
        ),
      },
    };
  if (Object.keys(state.leases).length >= policy.concurrent)
    return { state, decision: { allowed: false, retryAfter: 1 } };
  state.count++;
  state.clients[client] = (state.clients[client] ?? 0) + 1;
  state.leases[token] = now + policy.leaseMs;
  return { state, decision: { allowed: true, token } };
}
export function releaseBudget(state: BudgetState, token: string) {
  const next = structuredClone(state);
  delete next.leases[token];
  return next;
}
