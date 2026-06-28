import { readJson, writeJson } from "../store.js";
import { OPENCODE_CONFIG, OPENAI_BASE_URL, CLIENT_UA, resolveModelsMeta } from "../config.js";

const isClaude = (id) => id.startsWith("claude");

function modelMap(list) {
  const models = {};
  for (const m of list) {
    models[m.id] = { name: m.name, limit: { context: m.ctx, output: m.out } };
  }
  return models;
}

export function applyOpencode(key, model) {
  const cfg = readJson(OPENCODE_CONFIG);
  if (!cfg.$schema) cfg.$schema = "https://opencode.ai/config.json";
  cfg.provider = cfg.provider || {};

  const all = resolveModelsMeta(model);
  const claude = all.filter((m) => isClaude(m.id));
  const other = all.filter((m) => !isClaude(m.id));
  const options = { baseURL: OPENAI_BASE_URL, apiKey: key, headers: { "User-Agent": CLIENT_UA, "x-app": "cli" } };

  if (other.length) {
    cfg.provider.agentrouter = {
      npm: "@ai-sdk/openai-compatible",
      name: "AgentRouter",
      options,
      models: modelMap(other)
    };
  }
  if (claude.length) {
    cfg.provider["agentrouter-claude"] = {
      npm: "@ai-sdk/anthropic",
      name: "AgentRouter Claude",
      options,
      models: modelMap(claude)
    };
  }

  cfg.model = (isClaude(model) ? "agentrouter-claude/" : "agentrouter/") + model;

  return writeJson(OPENCODE_CONFIG, cfg);
}
