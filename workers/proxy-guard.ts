import { DurableObject } from "cloudflare:workers";
import {
  acquireBudget,
  emptyBudget,
  releaseBudget,
  type BudgetState,
} from "../src/server/request-budget";

// Private binding only. Stores counters/leases, never records or raw IPs.
export class ProxyGuard extends DurableObject {
  async fetch(request: Request) {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    const input = (await request.json()) as { client?: string; token?: string };
    const path = new URL(request.url).pathname;
    if (
      path === "/acquire" &&
      typeof input.client === "string" &&
      /^[a-f0-9]{64}$/.test(input.client)
    ) {
      const decision = await this.ctx.storage.transaction(async (storage) => {
        const previous = await storage.get<BudgetState>("budget");
        const result = acquireBudget(
          previous,
          input.client!,
          Date.now(),
          crypto.randomUUID(),
        );
        if (result.decision.allowed) {
          await storage.put("budget", result.state);
          await storage.setAlarm(Date.now() + 90000);
        }
        return result.decision;
      });
      return Response.json(decision);
    }
    if (
      path === "/release" &&
      typeof input.token === "string" &&
      /^[a-f0-9-]{36}$/.test(input.token)
    ) {
      await this.ctx.storage.transaction(async (storage) => {
        const state =
          (await storage.get<BudgetState>("budget")) ?? emptyBudget(Date.now());
        await storage.put("budget", releaseBudget(state, input.token!));
      });
      return new Response(null, { status: 204 });
    }
    return new Response("Invalid gate request", { status: 400 });
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
export default {
  fetch() {
    return new Response("Not found", { status: 404 });
  },
};
