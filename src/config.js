import { homedir } from "node:os";
import { join } from "node:path";

export const BASE_URL = process.env.ROUTERIN_BASE_URL || "https://agentrouter.org";
export const OPENAI_BASE_URL = BASE_URL + "/v1";
export const ANTHROPIC_VERSION = "2023-06-01";
export const CLIENT_UA = "claude-cli/2.0.1 (external, cli)";

export const MODELS_META = [
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", ctx: 200000, out: 64000, reasoning: true },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7", ctx: 200000, out: 64000, reasoning: true },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", ctx: 200000, out: 64000, reasoning: true },
  { id: "glm-5.2", name: "GLM 5.2", ctx: 200000, out: 64000, reasoning: true },
  { id: "gpt-5.5", name: "GPT 5.5", ctx: 200000, out: 64000, reasoning: true }
];

export const MODELS = MODELS_META.map((m) => m.id);

export function resolveModelsMeta(chosen) {
  if (!chosen || MODELS_META.some((m) => m.id === chosen)) return MODELS_META;
  return [
    { id: chosen, name: chosen, ctx: 200000, out: 64000, reasoning: true },
    ...MODELS_META
  ];
}

export const DEFAULT_MODEL = "claude-opus-4-8";
export const SMALL_FAST_MODEL = "glm-5.2";
export const TEST_MODEL = "glm-5.2";

export const TARGETS = ["claude", "opencode", "codex", "pi", "launcher"];

const XDG_CONFIG = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");

export const STORE_DIR = join(homedir(), ".routerin");
export const STORE_FILE = join(STORE_DIR, "config.json");
export const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
export const OPENCODE_CONFIG = join(XDG_CONFIG, "opencode", "opencode.json");
export const CODEX_CONFIG = join(homedir(), ".codex", "config.toml");
export const CODEX_ENV = join(homedir(), ".codex", ".env");
export const PI_MODELS = join(homedir(), ".pi", "agent", "models.json");

export function targetFiles(target) {
  return {
    claude: [CLAUDE_SETTINGS],
    opencode: [OPENCODE_CONFIG],
    codex: [CODEX_CONFIG, CODEX_ENV],
    pi: [PI_MODELS]
  }[target] || [];
}
