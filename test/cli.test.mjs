import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { tempHome, capture } from "./helpers.mjs";

tempHome();
const { cli } = await import("../src/cli.js");
const cfg = await import("../src/config.js");
const store = await import("../src/store.js");

const okConn = async () => ({ ok: true });
const noteConn = async () => ({ ok: true, note: "rate limited" });
const gateConn = async () => ({ ok: false, gate: true });
const quotaConn = async () => ({ ok: false, quota: true });
const errConn = async () => ({ ok: false, error: "timeout" });
const bodyConn = async () => ({ ok: false, body: "weird" });
const statusConn = async () => ({ ok: false, status: 500 });

async function run(argv, deps) {
  const c = capture();
  const code = await cli(argv, deps);
  c.restore();
  return { code, out: c.text() };
}

test("help variants", async () => {
  for (const a of [["-h"], ["--help"], ["help"]]) {
    const { code, out } = await run(a);
    assert.equal(code, 0);
    assert.ok(out.includes("routerin —"));
  }
});

test("status: not configured then configured", async () => {
  let { out } = await run(["status"]);
  assert.ok(out.includes("not configured"));
  store.saveConfig({ key: "sk-abcdef1234", model: "glm-5.2", targets: ["claude", "pi"] });
  ({ out } = await run(["status"]));
  assert.ok(out.includes("sk-abc"));
  assert.ok(out.includes("glm-5.2"));
});

test("test command: no key", async () => {
  store.saveConfig({ key: "", model: "m", targets: [] });
  const { code, out } = await run(["test"], { testConnection: okConn });
  assert.equal(code, 1);
  assert.ok(out.includes("no key"));
});

test("test command: ok / note / gate / quota / error / body / status", async () => {
  const k = ["test", "--key", "sk-x"];
  assert.equal((await run(k, { testConnection: okConn })).code, 0);
  assert.ok((await run(k, { testConnection: noteConn })).out.includes("rate limited"));
  assert.equal((await run(k, { testConnection: gateConn })).code, 1);
  assert.ok((await run(k, { testConnection: quotaConn })).out.includes("insufficient quota"));
  assert.ok((await run(k, { testConnection: errConn })).out.includes("timeout"));
  assert.ok((await run(k, { testConnection: bodyConn })).out.includes("weird"));
  assert.ok((await run(k, { testConnection: statusConn })).out.includes("500"));
});

test("test command: uses stored key when no flag", async () => {
  store.saveConfig({ key: "sk-stored", model: "glm-5.2", targets: ["claude"] });
  const { code } = await run(["test"], { testConnection: okConn });
  assert.equal(code, 0);
});

test("test command: no stored config and no key flag", async () => {
  rmSync(cfg.STORE_FILE, { force: true });
  const { code, out } = await run(["test"], { testConnection: okConn });
  assert.equal(code, 1);
  assert.ok(out.includes("no key"));
});

test("setup: every failure-reason branch", async () => {
  for (const conn of [gateConn, quotaConn, errConn, bodyConn, statusConn]) {
    const { out } = await run(["setup", "--yes", "--key", "sk-f", "--targets", "pi"], { testConnection: conn });
    assert.ok(out.includes("FAILED"));
  }
});

test("setup --yes without key", async () => {
  const { code, out } = await run(["setup", "--yes"], { testConnection: okConn });
  assert.equal(code, 1);
  assert.ok(out.includes("--yes requires --key"));
});

test("setup: success with rate-limited note", async () => {
  const { out } = await run(["setup", "--yes", "--key", "sk-rl", "--targets", "pi"], { testConnection: noteConn });
  assert.ok(out.includes("OK (rate limited)"));
});

test("setup: launcher present alongside a written target (no launcher hint)", async () => {
  const fakeWizard = async () => ({ key: "sk", model: "glm-5.2", targets: ["claude", "launcher"] });
  const { out } = await run(["setup"], { testConnection: okConn, runWizard: fakeWizard });
  assert.ok(!out.includes("launcher (use: routerin run"));
});

test("setup --yes with targets filter + claude message", async () => {
  const { code, out } = await run(
    ["setup", "--yes", "--key", "sk-y", "--model", "glm-5.2", "--targets", "claude,pi,bogus"],
    { testConnection: okConn }
  );
  assert.equal(code, 0);
  assert.ok(out.includes("claude"));
  assert.ok(out.includes("start Claude Code"));
  assert.equal(store.loadConfig().targets.length, 2);
});

test("setup --yes with all-invalid targets falls back to claude", async () => {
  await run(["setup", "--yes", "--key", "sk-b", "--targets", "bogus,nope"], { testConnection: okConn });
  assert.deepEqual(store.loadConfig().targets, ["claude"]);
});

test("setup --yes empty targets -> default claude; failed test prints reason", async () => {
  const { out } = await run(["setup", "--yes", "--key", "sk-z"], { testConnection: gateConn });
  assert.ok(out.includes("FAILED"));
});

test("setup via leading --flag (no subcommand) uses wizard", async () => {
  const fakeWizard = async () => ({ key: "sk-w", model: "glm-5.2", targets: ["launcher"] });
  const { code, out } = await run(["--model", "glm-5.2"], { testConnection: okConn, runWizard: fakeWizard });
  assert.equal(code, 0);
  assert.ok(out.includes("launcher (use: routerin run"));
});

test("no command defaults to setup (wizard)", async () => {
  const fakeWizard = async () => ({ key: "sk-n", model: "glm-5.2", targets: ["claude"] });
  const { code } = await run([], { testConnection: okConn, runWizard: fakeWizard });
  assert.equal(code, 0);
});

test("restore reverts and clears store", async () => {
  store.saveConfig({ key: "sk", model: "m", targets: ["claude"] });
  const { code, out } = await run(["restore"]);
  assert.equal(code, 0);
  assert.ok(out.includes("config cleared"));
  assert.ok(!existsSync(cfg.STORE_FILE));
});

test("run: no config", async () => {
  const { code, out } = await run(["run", "--", "echo", "hi"]);
  assert.equal(code, 1);
  assert.ok(out.includes("not configured"));
});

test("run: with config delegates to runWith (with and without --)", async () => {
  store.saveConfig({ key: "sk", model: "m", targets: ["claude"] });
  let seen;
  const fakeRun = async (_c, argv) => ((seen = argv), 42);
  let r = await run(["run", "--", "claude", "-p"], { runWith: fakeRun });
  assert.equal(r.code, 42);
  assert.deepEqual(seen, ["claude", "-p"]);
  r = await run(["run", "claude"], { runWith: fakeRun });
  assert.deepEqual(seen, ["claude"]);
});

test("setup writes codex target", async () => {
  const { out } = await run(
    ["setup", "--yes", "--key", "sk-c", "--targets", "codex,opencode"],
    { testConnection: okConn }
  );
  assert.ok(out.includes("codex"));
  assert.ok(out.includes("opencode"));
});

test("default deps used when none injected (no network command)", async () => {
  const { code } = await run(["help"]);
  assert.equal(code, 0);
});

test("unknown command", async () => {
  const { code, out } = await run(["wat"]);
  assert.equal(code, 1);
  assert.ok(out.includes("unknown command"));
});
