import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { backup } from "../store.js";
import { BASE_URL, CLAUDE_SETTINGS, SMALL_FAST_MODEL } from "../config.js";

export function applyClaudeCode(key, model) {
  let settings = {};
  if (existsSync(CLAUDE_SETTINGS)) {
    backup(CLAUDE_SETTINGS);
    try {
      settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf8"));
    } catch {
      settings = {};
    }
  }

  settings.env = {
    ...(settings.env || {}),
    ANTHROPIC_BASE_URL: BASE_URL,
    ANTHROPIC_AUTH_TOKEN: key,
    ANTHROPIC_MODEL: model,
    ANTHROPIC_SMALL_FAST_MODEL: SMALL_FAST_MODEL
  };

  mkdirSync(dirname(CLAUDE_SETTINGS), { recursive: true });
  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + "\n");
  return CLAUDE_SETTINGS;
}
