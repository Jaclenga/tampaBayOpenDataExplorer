import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
const policy = JSON.parse(readFileSync("config/proxy-budget.json", "utf8"));
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: ".wrangler/guard-build/proxy-guard.js",
    compatibilityDate: "2026-11-04",
    durableObjects: {
      PROXY_GUARD: { className: "ProxyGuard", useSQLite: true },
    },
  }),
);
try {
  const namespace = await runtime.getDurableObjectNamespace("PROXY_GUARD");
  const gate = namespace.get(namespace.idFromName("concurrency"));
  const acquire = async (stub, client) =>
    (
      await stub.fetch("https://guard/acquire", {
        method: "POST",
        body: JSON.stringify({ client }),
      })
    ).json();
  const release = async (stub, token) =>
    assert.equal(
      (
        await stub.fetch("https://guard/release", {
          method: "POST",
          body: JSON.stringify({ token }),
        })
      ).status,
      204,
    );
  const secondStub = namespace.get(namespace.idFromName("concurrency"));
  const burst = await Promise.all(
    Array.from({ length: policy.concurrent + 4 }, (_, index) =>
      acquire(index % 2 ? gate : secondStub, "a".repeat(64)),
    ),
  );
  const allowed = burst.filter((result) => result.allowed);
  assert.equal(allowed.length, policy.concurrent);
  assert.equal(burst.filter((result) => !result.allowed).length, 4);
  await Promise.all(allowed.map((result) => release(gate, result.token)));
  const available = await acquire(gate, "b".repeat(64));
  assert.equal(available.allowed, true);
  await release(gate, available.token);
  const limited = namespace.get(namespace.idFromName("rate"));
  const remaining = policy.windowMs - (Date.now() % policy.windowMs);
  if (remaining < 10000)
    await new Promise((resolve) => setTimeout(resolve, remaining + 50));
  for (let i = 0; i < policy.perClient; i++) {
    const result = await acquire(limited, "c".repeat(64));
    assert.equal(result.allowed, true);
    await release(limited, result.token);
  }
  assert.equal((await acquire(limited, "c".repeat(64))).allowed, false);
  const different = await acquire(limited, "d".repeat(64));
  assert.equal(different.allowed, true);
  await release(limited, different.token);
  assert.equal(
    (
      await gate.fetch("https://guard/acquire", {
        method: "POST",
        body: JSON.stringify({ client: "bad-client" }),
      })
    ).status,
    400,
  );
  assert.equal((await runtime.dispatchFetch("https://guard/")).status, 404);
  console.log(
    JSON.stringify({
      runtime: "workerd",
      sqlite: true,
      concurrencyLimit: policy.concurrent,
      perClientLimit: policy.perClient,
      release: true,
      privateWorker: true,
    }),
  );
} finally {
  await runtime.dispose();
}
