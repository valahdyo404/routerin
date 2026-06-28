import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ROUTERIN_BASE_URL = "http://127.0.0.1:1";
const api = await import("../src/api.js");

test("testConnection: connection error resolves with error", async () => {
  const r = await api.testConnection("k", "ok", 3000);
  assert.equal(r.ok, false);
  assert.ok(r.error);
});
