import { readJson, writeJson } from "../store.js";
import { PI_MODELS, OPENAI_BASE_URL, CLIENT_UA, resolveModelsMeta } from "../config.js";

export function applyPi(key, model) {
  const cfg = readJson(PI_MODELS);
  cfg.providers = cfg.providers || {};

  cfg.providers.agentrouter = {
    baseUrl: OPENAI_BASE_URL,
    api: "anthropic-messages",
    apiKey: key,
    headers: { "User-Agent": CLIENT_UA },
    models: resolveModelsMeta(model).map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: ["text"],
      contextWindow: m.ctx,
      maxTokens: m.out,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    }))
  };

  return writeJson(PI_MODELS, cfg);
}
