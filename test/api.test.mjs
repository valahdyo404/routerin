import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const server = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const model = JSON.parse(b).model;
    if (model === "hang") return;
    const map = {
      ok: "event: message_start\ndata: {}\n",
      gate: '{"error":"unauthorized client detected"}',
      quota: '{"error":"insufficient_user_quota"}',
      rate: '{"error":"TPM Ratelimit"}',
      generic: '{"error":"weird thing"}'
    };
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(map[model] ?? "");
  });
});

let api;
before(async () => {
  await new Promise((r) => server.listen(0, r));
  process.env.ROUTERIN_BASE_URL = `http://localhost:${server.address().port}`;
  api = await import("../src/api.js");
});
after(() => {
  if (server.listening) {
    server.closeAllConnections?.();
    server.close();
  }
});

test("pickRequest selects http vs https", () => {
  assert.equal(api.pickRequest("http:").name, "request");
  assert.notEqual(api.pickRequest("http:"), api.pickRequest("https:"));
});

test("classify covers all branches", () => {
  assert.deepEqual(api.classify("x event: message_start y"), { ok: true });
  assert.equal(api.classify("unauthorized client detected").gate, true);
  assert.equal(api.classify("insufficient_user_quota").quota, true);
  assert.equal(api.classify("额度不足").quota, true);
  assert.equal(api.classify("TPM Ratelimit").note, "rate limited");
  assert.deepEqual(api.classify("plain"), { ok: false });
});

test("testConnection: streaming success (early resolve)", async () => {
  const r = await api.testConnection("k", "ok");
  assert.equal(r.ok, true);
});

test("testConnection: gate / quota / rate / generic via end", async () => {
  assert.equal((await api.testConnection("k", "gate")).gate, true);
  assert.equal((await api.testConnection("k", "quota")).quota, true);
  assert.equal((await api.testConnection("k", "rate")).ok, true);
  const g = await api.testConnection("k", "generic");
  assert.equal(g.ok, false);
  assert.ok(g.body.includes("weird"));
});

test("testConnection: timeout", async () => {
  const r = await api.testConnection("k", "hang", 150);
  assert.equal(r.error, "timeout");
});
