import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tempHome } from "./helpers.mjs";

const home = tempHome();
const store = await import("../src/store.js");

test("readJson: missing, valid, invalid", () => {
  const p = join(home, "a.json");
  assert.deepEqual(store.readJson(p), {});
  writeFileSync(p, JSON.stringify({ x: 1 }));
  assert.deepEqual(store.readJson(p), { x: 1 });
  writeFileSync(p, "{not json");
  assert.deepEqual(store.readJson(p), {});
});

test("writeJson backs up existing then writes", () => {
  const p = join(home, "b.json");
  store.writeJson(p, { v: 1 });
  assert.ok(!existsSync(p + ".routerin.bak"));
  store.writeJson(p, { v: 2 });
  assert.equal(JSON.parse(readFileSync(p + ".routerin.bak", "utf8")).v, 1);
  store.writeJson(p, { v: 3 });
  assert.equal(JSON.parse(readFileSync(p + ".routerin.bak", "utf8")).v, 1, "bak keeps earliest original");
});

test("backup is a no-op when file absent", () => {
  const p = join(home, "ghost.json");
  store.backup(p);
  assert.ok(!existsSync(p + ".routerin.bak"));
});

test("restoreFile: restored from bak", () => {
  const p = join(home, "c.json");
  writeFileSync(p, "ORIG");
  store.backup(p);
  writeFileSync(p, "CHANGED");
  assert.equal(store.restoreFile(p), "restored");
  assert.equal(readFileSync(p, "utf8"), "ORIG");
  assert.ok(!existsSync(p + ".routerin.bak"));
});

test("restoreFile: removes routerin-created file (agentrouter marker, any case)", () => {
  const p = join(home, "d.json");
  writeFileSync(p, '{"x":"AGENTROUTER_API_KEY=sk"}');
  assert.equal(store.restoreFile(p), "removed");
  assert.ok(!existsSync(p));
});

test("restoreFile: skips unrelated file and missing file", () => {
  const p = join(home, "e.json");
  writeFileSync(p, "unrelated content");
  assert.equal(store.restoreFile(p), "skip");
  assert.ok(existsSync(p));
  assert.equal(store.restoreFile(join(home, "missing.json")), "skip");
});

test("loadConfig / saveConfig roundtrip + corrupt", async () => {
  const { STORE_FILE } = await import("../src/config.js");
  assert.equal(store.loadConfig(), null);
  store.saveConfig({ key: "k", model: "m", targets: ["claude"] });
  assert.equal(store.loadConfig().model, "m");
  writeFileSync(STORE_FILE, "{broken");
  assert.equal(store.loadConfig(), null);
});

test("maskKey", () => {
  assert.equal(store.maskKey(""), "(none)");
  assert.equal(store.maskKey("short"), "***");
  assert.equal(store.maskKey("sk-abcdef1234567890"), "sk-abc...7890");
});
