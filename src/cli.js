import { existsSync, rmSync } from "node:fs";
import { loadConfig, saveConfig, maskKey, restoreFile } from "./store.js";
import { runWizard } from "./wizard.js";
import { testConnection } from "./api.js";
import { applyClaudeCode } from "./targets/claudeCode.js";
import { applyOpencode } from "./targets/opencode.js";
import { applyCodex } from "./targets/codex.js";
import { applyPi } from "./targets/pi.js";
import { runWith } from "./targets/launcher.js";
import { BASE_URL, DEFAULT_MODEL, TEST_MODEL, TARGETS, STORE_FILE, targetFiles } from "./config.js";

export function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (k === "yes") flags.yes = true;
      else flags[k] = args[++i];
    }
  }
  return flags;
}

function help() {
  console.log(`
routerin — route Claude Code & other CLI tools through AgentRouter

  routerin setup            interactive wizard (default)
    --key sk-...            api key
    --model <name>          default model
    --targets <list>        claude,opencode,codex,pi  (comma-separated)
    --yes                   non-interactive

  routerin test [--model m] [--key k]   probe connection
  routerin status                        show saved config
  routerin restore                       revert all tool configs to pre-routerin
  routerin run -- <cmd...>               launch a tool via AgentRouter

  models: claude-opus-4-8 | claude-opus-4-7 | claude-opus-4-6 | glm-5.2 | gpt-5.5
`);
}

function applyTargets(cfg) {
  const done = [];
  if (cfg.targets.includes("claude")) done.push(`claude   -> ${applyClaudeCode(cfg.key, cfg.model)}`);
  if (cfg.targets.includes("opencode")) done.push(`opencode -> ${applyOpencode(cfg.key, cfg.model)}`);
  if (cfg.targets.includes("codex")) {
    const r = applyCodex(cfg.key, cfg.model);
    done.push(`codex    -> ${r.config} (+${r.env})`);
  }
  if (cfg.targets.includes("pi")) done.push(`pi       -> ${applyPi(cfg.key, cfg.model)}`);
  return done;
}

function parseTargets(value) {
  const t = value.split(",").map((s) => s.trim()).filter((s) => TARGETS.includes(s));
  return t.length ? t : ["claude"];
}

async function cmdSetup(flags, deps) {
  let cfg;
  if (flags.yes) {
    if (!flags.key) {
      console.error("--yes requires --key");
      return 1;
    }
    cfg = {
      key: flags.key,
      model: flags.model || DEFAULT_MODEL,
      targets: flags.targets ? parseTargets(flags.targets) : ["claude"]
    };
  } else {
    cfg = await deps.runWizard({ key: flags.key, model: flags.model });
  }

  const done = applyTargets(cfg);
  saveConfig(cfg);

  console.log("\n  configured:");
  done.forEach((d) => console.log("    " + d));
  if (cfg.targets.includes("launcher") && !done.length) {
    console.log("    launcher (use: routerin run -- <cmd>)");
  }

  process.stdout.write("\n  testing connection (glm-5.2)... ");
  const r = await deps.testConnection(cfg.key, TEST_MODEL);
  if (r.ok) console.log(r.note ? `OK (${r.note})\n` : "OK\n");
  else console.log("FAILED: " + (r.gate ? "unauthorized client (gate)" : r.quota ? "insufficient quota" : r.error || r.body || r.status) + "\n");

  if (cfg.targets.includes("claude")) console.log("  done. start Claude Code: claude\n");
  return 0;
}

async function cmdTest(flags, deps) {
  const cfg = loadConfig();
  const key = flags.key || (cfg && cfg.key);
  const model = flags.model || TEST_MODEL;
  if (!key) {
    console.error("no key. run: routerin setup");
    return 1;
  }
  process.stdout.write(`testing ${model}... `);
  const r = await deps.testConnection(key, model);
  if (r.ok) {
    console.log(r.note ? `OK (${r.note})` : "OK");
    return 0;
  }
  console.log("FAILED: " + (r.gate ? "unauthorized client (gate)" : r.quota ? "insufficient quota for this model" : r.error || r.body || r.status));
  return 1;
}

function cmdStatus() {
  const cfg = loadConfig();
  if (!cfg) {
    console.log("not configured. run: routerin setup");
    return 0;
  }
  console.log("\n  routerin status");
  console.log("    base url : " + BASE_URL);
  console.log("    key      : " + maskKey(cfg.key));
  console.log("    model    : " + cfg.model);
  console.log("    targets  : " + cfg.targets.join(", "));
  console.log("");
  return 0;
}

function cmdRestore() {
  console.log("\n  restoring configs to pre-routerin state:");
  for (const t of TARGETS) {
    for (const path of targetFiles(t)) {
      const result = restoreFile(path);
      if (result !== "skip") console.log(`    ${result}: ${path}`);
    }
  }
  if (existsSync(STORE_FILE)) rmSync(STORE_FILE);
  console.log("\n  done. routerin config cleared.\n");
  return 0;
}

export async function cli(argv, deps = {}) {
  const d = {
    testConnection: deps.testConnection || testConnection,
    runWizard: deps.runWizard || runWizard,
    runWith: deps.runWith || runWith
  };
  const cmd = argv[0];

  if (cmd === "run") {
    const cfg = loadConfig();
    if (!cfg) {
      console.error("not configured. run: routerin setup");
      return 1;
    }
    const sep = argv.indexOf("--");
    const rest = sep === -1 ? argv.slice(1) : argv.slice(sep + 1);
    return d.runWith(cfg, rest);
  }

  const isFlag = !cmd || cmd.startsWith("-");
  const flags = parseFlags(isFlag ? argv : argv.slice(1));

  if (cmd === "-h" || cmd === "--help" || cmd === "help") {
    help();
    return 0;
  }
  if (cmd === "status") return cmdStatus();
  if (cmd === "restore" || cmd === "uninstall") return cmdRestore();
  if (cmd === "test") return cmdTest(flags, d);
  if (!cmd || cmd === "setup" || cmd.startsWith("--")) return cmdSetup(flags, d);

  console.error("unknown command: " + cmd);
  help();
  return 1;
}
