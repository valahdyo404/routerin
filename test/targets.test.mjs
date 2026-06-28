import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { tempHome } from "./helpers.mjs";

tempHome();
const cfg = await import("../src/config.js");
const { applyClaudeCode } = await import("../src/targets/claudeCode.js");
const { applyOpencode } = await import("../src/targets/opencode.js");
const { applyCodex } = await import("../src/targets/codex.js");
const { applyPi } = await import("../src/targets/pi.js");

const read = (p) => JSON.parse(readFileSync(p, "utf8"));

test("claudeCode: creates fresh settings", () => {
  const p = applyClaudeCode("sk-1", "glm-5.2");
  const s = read(p);
  assert.equal(s.env.ANTHROPIC_BASE_URL, cfg.BASE_URL);
  assert.equal(s.env.ANTHROPIC_AUTH_TOKEN, "sk-1");
  assert.equal(s.env.ANTHROPIC_MODEL, "glm-5.2");
});

test("claudeCode: merges existing + backs up", () => {
  const p = cfg.CLAUDE_SETTINGS;
  writeFileSync(p, JSON.stringify({ theme: "dark", env: { FOO: "bar" } }));
  applyClaudeCode("sk-2", "claude-opus-4-8");
  const s = read(p);
  assert.equal(s.theme, "dark");
  assert.equal(s.env.FOO, "bar");
  assert.equal(s.env.ANTHROPIC_AUTH_TOKEN, "sk-2");
  assert.ok(existsSync(p + ".routerin.bak"));
});

test("claudeCode: tolerates invalid existing json", () => {
  const p = cfg.CLAUDE_SETTINGS;
  writeFileSync(p, "{broken");
  const s = read(applyClaudeCode("sk-3", "glm-5.2"));
  assert.equal(s.env.ANTHROPIC_AUTH_TOKEN, "sk-3");
});

test("opencode: non-claude default uses openai provider prefix", () => {
  const s = read(applyOpencode("sk", "glm-5.2"));
  assert.ok(s.provider.agentrouter);
  assert.ok(s.provider["agentrouter-claude"]);
  assert.equal(s.model, "agentrouter/glm-5.2");
  assert.ok(s.provider.agentrouter.models["glm-5.2"]);
  assert.ok(s.provider["agentrouter-claude"].models["claude-opus-4-8"]);
});

test("opencode: claude default uses anthropic provider prefix + preserves $schema", () => {
  const s = read(applyOpencode("sk", "claude-opus-4-6"));
  assert.equal(s.model, "agentrouter-claude/claude-opus-4-6");
  assert.equal(s.$schema, "https://opencode.ai/config.json");
});

test("codex: fresh writes block + env", () => {
  const r = applyCodex("sk-x", "glm-5.2");
  const toml = readFileSync(r.config, "utf8");
  assert.ok(toml.includes('model = "glm-5.2"'));
  assert.ok(toml.includes("User-Agent"));
  assert.ok(readFileSync(r.env, "utf8").includes("AGENTROUTER_API_KEY=sk-x"));
});

test("codex: replaces prior routerin block, keeps user content", () => {
  const p = cfg.CODEX_CONFIG;
  mkdirSync(dirname(p), { recursive: true });
  applyCodex("sk-old", "glm-5.2");
  writeFileSync(p, '[user]\nkeep = 1\n\n' + readFileSync(p, "utf8"));
  applyCodex("sk-new", "claude-opus-4-8");
  const toml = readFileSync(p, "utf8");
  assert.ok(toml.includes("keep = 1"));
  assert.ok(toml.includes('model = "claude-opus-4-8"'));
  assert.equal(toml.match(/model_provider = "agentrouter"/g).length, 1);
});

test("pi: splits openai-completions (glm/gpt) and anthropic-messages (claude)", () => {
  const s = read(applyPi("sk-pi", "glm-5.2"));
  const oai = s.providers.agentrouter;
  const ant = s.providers["agentrouter-claude"];
  assert.equal(oai.api, "openai-completions");
  assert.equal(oai.baseUrl, cfg.OPENAI_BASE_URL);
  assert.ok(oai.models.some((m) => m.id === "glm-5.2"));
  assert.ok(oai.models.some((m) => m.id === "gpt-5.5"));
  assert.equal(ant.api, "anthropic-messages");
  assert.equal(ant.baseUrl, cfg.BASE_URL);
  assert.ok(!ant.baseUrl.endsWith("/v1"), "anthropic sdk appends /v1/messages itself");
  assert.ok(ant.models.some((m) => m.id === "claude-opus-4-8"));
  for (const m of [...oai.models, ...ant.models]) {
    assert.deepEqual(Object.keys(m.cost).sort(), ["cacheRead", "cacheWrite", "input", "output"]);
  }
});
