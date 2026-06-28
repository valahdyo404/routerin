import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function tempHome() {
  const home = mkdtempSync(join(tmpdir(), "routerin-test-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return home;
}

export function capture() {
  const out = [];
  const log = console.log;
  const err = console.error;
  const write = process.stdout.write;
  console.log = (...a) => out.push(a.join(" "));
  console.error = (...a) => out.push(a.join(" "));
  process.stdout.write = (s) => (out.push(String(s)), true);
  return {
    text: () => out.join("\n"),
    restore: () => {
      console.log = log;
      console.error = err;
      process.stdout.write = write;
    }
  };
}
