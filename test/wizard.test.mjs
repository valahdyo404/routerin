import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { tempHome } from "./helpers.mjs";

tempHome();
const { runWizard } = await import("../src/wizard.js");

async function wizard(defaults, answers) {
  const queue = [...answers];
  const input = new PassThrough();
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (/: $/.test(chunk.toString()) && queue.length) input.write(queue.shift() + "\n");
      cb();
    }
  });
  try {
    return await runWizard(defaults, { input, output });
  } finally {
    input.end();
    input.destroy();
  }
}

test("wizard: empty key loops, then number model, number targets", async () => {
  const r = await wizard({}, ["", "sk-key", "4", "1,2"]);
  assert.equal(r.key, "sk-key");
  assert.equal(r.model, "glm-5.2");
  assert.deepEqual(r.targets, ["claude", "opencode"]);
});

test("wizard: key from defaults, pasted model id, pasted target name", async () => {
  const r = await wizard({ key: "sk-d" }, ["my-custom-model", "pi,codex"]);
  assert.equal(r.key, "sk-d");
  assert.equal(r.model, "my-custom-model");
  assert.deepEqual(r.targets, ["pi", "codex"]);
});

test("wizard: empty model -> default, empty targets -> claude", async () => {
  const r = await wizard({ key: "sk", model: "gpt-5.5" }, ["", ""]);
  assert.equal(r.model, "gpt-5.5");
  assert.deepEqual(r.targets, ["claude"]);
});

test("wizard: invalid targets fall back to claude", async () => {
  const r = await wizard({ key: "sk" }, ["1", "99,nonsense"]);
  assert.deepEqual(r.targets, ["claude"]);
});

test("wizard: falls back to process.stdin/stdout when io omitted", async () => {
  const realIn = Object.getOwnPropertyDescriptor(process, "stdin");
  const realOut = Object.getOwnPropertyDescriptor(process, "stdout");
  const input = new PassThrough();
  const queue = ["", ""];
  const output = new Writable({
    write(chunk, _e, cb) {
      if (/: $/.test(chunk.toString()) && queue.length) input.write(queue.shift() + "\n");
      cb();
    }
  });
  Object.defineProperty(process, "stdin", { value: input, configurable: true });
  Object.defineProperty(process, "stdout", { value: output, configurable: true });
  try {
    const r = await runWizard({ key: "sk" });
    assert.equal(r.model, "claude-opus-4-8");
    assert.deepEqual(r.targets, ["claude"]);
  } finally {
    Object.defineProperty(process, "stdin", realIn);
    Object.defineProperty(process, "stdout", realOut);
    input.end();
    input.destroy();
  }
});
