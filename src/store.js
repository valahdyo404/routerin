import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { STORE_DIR, STORE_FILE } from "./config.js";

const BAK = ".routerin.bak";

export function backup(path) {
  if (existsSync(path) && !existsSync(path + BAK)) copyFileSync(path, path + BAK);
}

export function restoreFile(path) {
  if (existsSync(path + BAK)) {
    copyFileSync(path + BAK, path);
    unlinkSync(path + BAK);
    return "restored";
  }
  if (existsSync(path) && readFileSync(path, "utf8").toLowerCase().includes("agentrouter")) {
    unlinkSync(path);
    return "removed";
  }
  return "skip";
}

export function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function writeJson(path, data) {
  backup(path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}

export function loadConfig() {
  if (!existsSync(STORE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(config, null, 2) + "\n");
  return STORE_FILE;
}

export function maskKey(key) {
  if (!key) return "(none)";
  if (key.length <= 10) return "***";
  return key.slice(0, 6) + "..." + key.slice(-4);
}
