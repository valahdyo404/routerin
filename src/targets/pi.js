import { readJson, writeJson } from "../store.js";
import { PI_MODELS, BASE_URL, OPENAI_BASE_URL, CLIENT_UA, resolveModelsMeta } from "../config.js";

const isClaude = (id) => id.startsWith("claude");

function modelList(list) {
  return list.map((m) => ({
    id: m.id,
    name: m.name,
    reasoning: m.reasoning,
    input: ["text"],
    contextWindow: m.ctx,
    maxTokens: m.out,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  }));
}

export function applyPi(key, model) {
  const cfg = readJson(PI_MODELS);
  cfg.providers = cfg.providers || {};

  const all = resolveModelsMeta(model);
  const claude = all.filter((m) => isClaude(m.id));
  const other = all.filter((m) => !isClaude(m.id));
  const headers = { "User-Agent": CLIENT_UA };

  if (other.length) {
    cfg.providers.agentrouter = {
      baseUrl: OPENAI_BASE_URL,
      api: "openai-completions",
      apiKey: key,
      headers,
      models: modelList(other)
    };
  }
  if (claude.length) {
    cfg.providers["agentrouter-claude"] = {
      baseUrl: BASE_URL,
      api: "anthropic-messages",
      apiKey: key,
      headers,
      models: modelList(claude)
    };
  }

  return writeJson(PI_MODELS, cfg);
}
