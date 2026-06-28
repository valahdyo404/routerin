import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { backup } from "../store.js";
import { CODEX_CONFIG, CODEX_ENV, OPENAI_BASE_URL, CLIENT_UA } from "../config.js";

const START = "# >>> routerin (agentrouter) >>>";
const END = "# <<< routerin (agentrouter) <<<";

export function applyCodex(key, model) {
  const block = [
    START,
    `model_provider = "agentrouter"`,
    `model = "${model}"`,
    "",
    "[model_providers.agentrouter]",
    `name = "AgentRouter"`,
    `base_url = "${OPENAI_BASE_URL}"`,
    `env_key = "AGENTROUTER_API_KEY"`,
    `wire_api = "chat"`,
    "",
    "[model_providers.agentrouter.http_headers]",
    `"User-Agent" = "${CLIENT_UA}"`,
    END
  ].join("\n");

  let existing = "";
  if (existsSync(CODEX_CONFIG)) {
    backup(CODEX_CONFIG);
    existing = readFileSync(CODEX_CONFIG, "utf8");
    const s = existing.indexOf(START);
    const e = existing.indexOf(END);
    if (s !== -1 && e !== -1) {
      existing = (existing.slice(0, s) + existing.slice(e + END.length)).trim();
    }
  }

  mkdirSync(dirname(CODEX_CONFIG), { recursive: true });
  const out = existing ? existing.trim() + "\n\n" + block + "\n" : block + "\n";
  writeFileSync(CODEX_CONFIG, out);

  backup(CODEX_ENV);
  writeFileSync(CODEX_ENV, `AGENTROUTER_API_KEY=${key}\n`);

  return { config: CODEX_CONFIG, env: CODEX_ENV };
}
