import { createInterface } from "node:readline";
import { MODELS, DEFAULT_MODEL, TARGETS } from "./config.js";

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

export async function runWizard(defaults = {}, io = {}) {
  const rl = createInterface({ input: io.input || process.stdin, output: io.output || process.stdout });

  console.log("\n  routerin — AgentRouter setup\n");

  let key = defaults.key;
  while (!key) {
    key = await ask(rl, "  AgentRouter API key (sk-...): ");
    if (!key) console.log("  key required.");
  }

  console.log("\n  models:");
  MODELS.forEach((m, i) => console.log(`    ${i + 1}) ${m}`));
  console.log("    or paste any model id (e.g. glm-5.2, gpt-5.5)");
  const def = defaults.model || DEFAULT_MODEL;
  const pick = await ask(rl, `\n  pick number or model id [${def}]: `);
  let model = def;
  if (pick) {
    const n = parseInt(pick, 10);
    model = String(n) === pick && MODELS[n - 1] ? MODELS[n - 1] : pick;
  }

  console.log("\n  targets:");
  console.log("    1) claude   (Claude Code)");
  console.log("    2) opencode");
  console.log("    3) codex");
  console.log("    4) pi");
  console.log("    5) launcher (escape hatch, no config write)");
  const tIn = await ask(rl, "\n  pick targets (comma, e.g. 1,2,3) [1]: ");
  let targets = ["claude"];
  if (tIn) {
    targets = tIn
      .split(",")
      .map((s) => s.trim())
      .map((s) => (/^\d+$/.test(s) ? TARGETS[parseInt(s, 10) - 1] : s))
      .filter((s) => TARGETS.includes(s));
    if (!targets.length) targets = ["claude"];
  }

  rl.close();
  return { key, model, targets };
}
