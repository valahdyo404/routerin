import { request } from "node:https";
import { writeFileSync } from "node:fs";

const UA = "claude-cli/2.0.1 (external, cli)";
const CLAUDE_MODELS = ["claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6"];

const now = () => Number(process.hrtime.bigint() / 1000000n);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

function one(key, model, maxTok) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      max_tokens: maxTok,
      stream: true,
      messages: [{ role: "user", content: "Write one short sentence about the sea." }]
    });
    const t0 = now();
    let inTok = 0;
    let outTok = 0;
    let err = null;
    const req = request(
      "https://agentrouter.org/v1/messages",
      { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json", "user-agent": UA, "x-app": "cli" } },
      (res) => {
        let buf = "";
        res.on("data", (c) => {
          buf += c.toString();
          let i;
          while ((i = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const j = JSON.parse(line.slice(5));
              if (j.type === "message_start" && j.message?.usage) inTok = j.message.usage.input_tokens || 0;
              if (j.usage?.output_tokens != null) outTok = j.usage.output_tokens;
              if (j.type === "error") err = j.error?.code || j.error?.type || "error";
            } catch {}
          }
        });
        res.on("end", () => {
          if (!err && res.statusCode !== 200) err = "http_" + res.statusCode;
          resolve({ ms: now() - t0, inTok, outTok, err });
        });
      }
    );
    req.on("error", (e) => resolve({ ms: now() - t0, err: e.message }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ ms: now() - t0, err: "timeout" }); });
    req.write(body);
    req.end();
  });
}

async function burst(key, model, total, conc, maxTok) {
  const results = [];
  let d = 0;
  const t0 = now();
  const w = async () => { while (d < total) { d++; results.push(await one(key, model, maxTok)); } };
  await Promise.all(Array.from({ length: conc }, w));
  const elapsed = (now() - t0) / 1000;
  const ok = results.filter((r) => !r.err);
  const tok = ok.reduce((a, r) => a + r.inTok + r.outTok, 0);
  const lat = ok.map((r) => r.ms).sort((a, b) => a - b);
  const errors = {};
  for (const f of results.filter((r) => r.err)) errors[f.err] = (errors[f.err] || 0) + 1;
  return {
    model, conc, total, maxTok,
    elapsed: +elapsed.toFixed(2),
    ok: ok.length,
    rps: +(ok.length / elapsed).toFixed(2),
    tpm: Math.round((tok / elapsed) * 60),
    tokens: tok,
    avgMs: ok.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
    p95Ms: lat.length ? lat[Math.max(0, Math.ceil(0.95 * lat.length) - 1)] : 0,
    errors
  };
}

function line(r) {
  const e = Object.keys(r.errors).length ? `  errors=${JSON.stringify(r.errors)}` : "";
  return `  conc=${String(r.conc).padStart(2)}  ok=${r.ok}/${r.total}  ${String(r.rps).padStart(5)} rps  ${String(r.tpm).padStart(6)} tpm  avg ${r.avgMs}ms  p95 ${r.p95Ms}ms${e}`;
}

const key = process.env.AGENTROUTER_API_KEY || process.argv[3];
const mode = process.argv[2] || "full";
const COOLDOWN = Number(process.env.COOLDOWN || 60);

if (!key) {
  console.error("usage: node scripts/bench.mjs <full|models|ramp> <key> [model]");
  process.exit(1);
}

const out = { generatedAt: new Date().toISOString(), cooldown: COOLDOWN, models: [], ramp: null };

if (mode === "models" || mode === "full") {
  console.log("== per-model (concurrency 5, 10 req each, cooldown between) ==");
  for (const m of CLAUDE_MODELS) {
    if (out.models.length) { console.log(`  ...cooldown ${COOLDOWN}s`); await sleep(COOLDOWN); }
    const r = await burst(key, m, 10, 5, 48);
    console.log(m + "\n" + line(r));
    out.models.push(r);
  }
}

if (mode === "ramp" || mode === "full") {
  const rm = process.argv[4] || "claude-opus-4-8";
  console.log(`\n== ramp ${rm} (concurrency 1..16, cooldown between) ==`);
  out.ramp = { model: rm, steps: [] };
  for (const c of [1, 2, 4, 8, 16]) {
    if (out.ramp.steps.length) { console.log(`  ...cooldown ${COOLDOWN}s`); await sleep(COOLDOWN); }
    const r = await burst(key, rm, c * 3, c, 48);
    console.log(line(r));
    out.ramp.steps.push(r);
    const failRate = (r.total - r.ok) / r.total;
    if (failRate >= 0.5) { console.log("  >50% throttled — ceiling reached, stopping ramp"); break; }
  }
}

writeFileSync(new URL("./bench-results.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log("\nwrote scripts/bench-results.json");
