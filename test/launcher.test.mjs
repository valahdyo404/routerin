import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { tempHome, capture } from "./helpers.mjs";

tempHome();
const { runWith } = await import("../src/targets/launcher.js");

function fakeSpawn(record) {
  return (cmd, args, opts) => {
    record.cmd = cmd;
    record.args = args;
    record.env = opts.env;
    const child = new EventEmitter();
    record.child = child;
    return child;
  };
}

test("runWith: no argv returns 1", async () => {
  const c = capture();
  const code = await runWith({ key: "k", model: "m" }, []);
  c.restore();
  assert.equal(code, 1);
});

test("runWith: injects env and resolves child exit code", async () => {
  const rec = {};
  const p = runWith({ key: "sk", model: "glm-5.2" }, ["claude", "-p", "hi"], fakeSpawn(rec));
  rec.child.emit("exit", 7);
  assert.equal(await p, 7);
  assert.equal(rec.cmd, "claude");
  assert.deepEqual(rec.args, ["-p", "hi"]);
  assert.equal(rec.env.ANTHROPIC_AUTH_TOKEN, "sk");
  assert.equal(rec.env.OPENAI_API_KEY, "sk");
});

test("runWith: null exit code becomes 0", async () => {
  const rec = {};
  const p = runWith({ key: "sk", model: "m" }, ["x"], fakeSpawn(rec));
  rec.child.emit("exit", null);
  assert.equal(await p, 0);
});

test("runWith: spawn error returns 1", async () => {
  const rec = {};
  const c = capture();
  const p = runWith({ key: "sk", model: "m" }, ["x"], fakeSpawn(rec));
  rec.child.emit("error", new Error("boom"));
  const code = await p;
  c.restore();
  assert.equal(code, 1);
});
