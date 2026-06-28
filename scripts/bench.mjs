import { request } from "node:https";

const KEY = process.env.AGENTROUTER_API_KEY || process.argv[2];
const MODEL = process.argv[3] || "claude-opus-4-8";
const TOTAL = Number(process.argv[4] || 12);
const CONC = Number(process.argv[5] || 4);
const MAXTOK = Number(process.argv[6] || 64);
const UA = "claude-cli/2.0.1 (external, cli)";

if (!KEY) {
  console.error("usage: AGENTROUTER_API_KEY=sk-... node scripts/bench.mjs [model] [total] [concurrency] [maxTokens]");
  process.exit(1);
}

function now() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function one() {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: MAXTOK,
      stream: true,
      messages: [{ role: "user", content: "Write one short sentence about the sea." }]
    });
    const t0 = now();
    let inTok = 0;
    let outTok = 0;
    let err = null;
    const req = request(
      "https://agentrouter.org/v1/messages",
      { method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json", "user-agent": UA, "x-app": "cli" } },
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
          resolve({ ms: now() - t0, status: res.statusCode, inTok, outTok, err });
        });
      }
    );
    req.on("error", (e) => resolve({ ms: now() - t0, err: e.message }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ ms: now() - t0, err: "timeout" }); });
    req.write(body);
    req.end();
  });
}

const results = [];
let dispatched = 0;
const tStart = now();

async function worker() {
  while (dispatched < TOTAL) {
    dispatched++;
    results.push(await one());
  }
}

console.log(`bench ${MODEL}  total=${TOTAL} concurrency=${CONC} maxTokens=${MAXTOK}`);
await Promise.all(Array.from({ length: CONC }, worker));
const elapsed = (now() - tStart) / 1000;

const ok = results.filter((r) => !r.err);
const fails = results.filter((r) => r.err);
const inSum = ok.reduce((a, r) => a + r.inTok, 0);
const outSum = ok.reduce((a, r) => a + r.outTok, 0);
const tokSum = inSum + outSum;
const lat = ok.map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))] : 0);
const errBreak = {};
for (const f of fails) errBreak[f.err] = (errBreak[f.err] || 0) + 1;

console.log("─".repeat(48));
console.log(`elapsed         : ${elapsed.toFixed(2)} s`);
console.log(`requests ok/total: ${ok.length}/${results.length}`);
console.log(`RPS (ok)        : ${(ok.length / elapsed).toFixed(2)} req/s`);
console.log(`tokens in/out   : ${inSum} / ${outSum}  (total ${tokSum})`);
console.log(`TPM             : ${Math.round((tokSum / elapsed) * 60)} tokens/min`);
console.log(`latency ms      : avg ${ok.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0}  p50 ${pct(50)}  p95 ${pct(95)}`);
if (fails.length) console.log(`errors          : ${JSON.stringify(errBreak)}`);
