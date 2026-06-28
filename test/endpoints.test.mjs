import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tempHome } from "./helpers.mjs";

tempHome();
const cfg = await import("../src/config.js");
const { applyClaudeCode } = await import("../src/targets/claudeCode.js");
const { applyOpencode } = await import("../src/targets/opencode.js");
const { applyCodex } = await import("../src/targets/codex.js");
const { applyPi } = await import("../src/targets/pi.js");

const ANTHROPIC = "https://agentrouter.org/v1/messages";
const OPENAI = "https://agentrouter.org/v1/chat/completions";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const isClaude = (id) => id.startsWith("claude");

// Each tool's documented URL-append convention -> final endpoint it will call.
const conventions = {
  // Claude Code appends /v1/messages to ANTHROPIC_BASE_URL
  claude: (base) => base + "/v1/messages",
  // @ai-sdk/anthropic appends /messages to baseURL
  opencodeAnthropic: (base) => base + "/messages",
  // @ai-sdk/openai-compatible appends /chat/completions to baseURL
  opencodeOpenai: (base) => base + "/chat/completions",
  // codex wire_api "chat" appends /chat/completions to base_url
  codex: (base) => base + "/chat/completions",
  // pi anthropic-messages (anthropic sdk) appends /v1/messages to baseUrl
  piAnthropic: (base) => base + "/v1/messages",
  // pi openai-completions (openai sdk) appends /chat/completions to baseUrl
  piOpenai: (base) => base + "/chat/completions"
};

for (const model of cfg.MODELS) {
  test(`claude code endpoint+model: ${model}`, () => {
    const s = read(applyClaudeCode("sk", model));
    assert.equal(conventions.claude(s.env.ANTHROPIC_BASE_URL), ANTHROPIC);
    assert.equal(s.env.ANTHROPIC_MODEL, model);
  });

  test(`opencode endpoint+model: ${model}`, () => {
    const s = read(applyOpencode("sk", model));
    if (isClaude(model)) {
      const p = s.provider["agentrouter-claude"];
      assert.equal(conventions.opencodeAnthropic(p.options.baseURL), ANTHROPIC);
      assert.ok(p.models[model]);
      assert.equal(s.model, "agentrouter-claude/" + model);
    } else {
      const p = s.provider.agentrouter;
      assert.equal(conventions.opencodeOpenai(p.options.baseURL), OPENAI);
      assert.ok(p.models[model]);
      assert.equal(s.model, "agentrouter/" + model);
    }
  });

  test(`codex endpoint+model: ${model}`, () => {
    const r = applyCodex("sk", model);
    const toml = readFileSync(r.config, "utf8");
    const base = toml.match(/base_url = "([^"]+)"/)[1];
    assert.equal(conventions.codex(base), OPENAI);
    assert.ok(toml.includes(`model = "${model}"`));
  });

  test(`pi endpoint+model: ${model}`, () => {
    const s = read(applyPi("sk", model));
    if (isClaude(model)) {
      const p = s.providers["agentrouter-claude"];
      assert.equal(conventions.piAnthropic(p.baseUrl), ANTHROPIC);
      assert.ok(p.models.some((m) => m.id === model));
    } else {
      const p = s.providers.agentrouter;
      assert.equal(conventions.piOpenai(p.baseUrl), OPENAI);
      assert.ok(p.models.some((m) => m.id === model));
    }
  });
}
