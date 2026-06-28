import { test } from "node:test";
import assert from "node:assert/strict";
import { tempHome } from "./helpers.mjs";

tempHome();
process.env.ROUTERIN_BASE_URL = "https://example.test";
const cfg = await import("../src/config.js");

test("BASE_URL honors env override, OPENAI derives from it", () => {
  assert.equal(cfg.BASE_URL, "https://example.test");
  assert.equal(cfg.OPENAI_BASE_URL, "https://example.test/v1");
});

test("MODELS derived from META", () => {
  assert.deepEqual(cfg.MODELS, cfg.MODELS_META.map((m) => m.id));
  assert.ok(cfg.MODELS.includes("glm-5.2"));
});

test("resolveModelsMeta returns base list for known model", () => {
  assert.equal(cfg.resolveModelsMeta("glm-5.2"), cfg.MODELS_META);
  assert.equal(cfg.resolveModelsMeta(""), cfg.MODELS_META);
});

test("resolveModelsMeta prepends unknown model", () => {
  const r = cfg.resolveModelsMeta("my-model-x");
  assert.equal(r[0].id, "my-model-x");
  assert.equal(r.length, cfg.MODELS_META.length + 1);
});

test("targetFiles maps each target and unknown", () => {
  assert.equal(cfg.targetFiles("claude").length, 1);
  assert.equal(cfg.targetFiles("codex").length, 2);
  assert.equal(cfg.targetFiles("opencode").length, 1);
  assert.equal(cfg.targetFiles("pi").length, 1);
  assert.deepEqual(cfg.targetFiles("nope"), []);
});
