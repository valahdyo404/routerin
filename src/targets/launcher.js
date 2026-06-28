import { spawn as nodeSpawn } from "node:child_process";
import { BASE_URL, OPENAI_BASE_URL } from "../config.js";

export function runWith(config, argv, spawn = nodeSpawn) {
  return new Promise((resolve) => {
    if (!argv.length) {
      console.error("usage: routerin run -- <command> [args...]");
      resolve(1);
      return;
    }

    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: BASE_URL,
      ANTHROPIC_AUTH_TOKEN: config.key,
      ANTHROPIC_MODEL: config.model,
      OPENAI_BASE_URL,
      OPENAI_API_KEY: config.key,
      AGENTROUTER_API_KEY: config.key
    };

    const child = spawn(argv[0], argv.slice(1), {
      stdio: "inherit",
      env,
      shell: process.platform === "win32"
    });
    child.on("error", (e) => {
      console.error("failed to launch:", e.message);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}
