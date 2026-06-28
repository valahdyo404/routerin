import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("./bench-results.json", import.meta.url), "utf8"));

const W = 560;
const H = 260;
const PAD = 48;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function barChart(title, items, valueKey, color, unit) {
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  const bw = (W - PAD * 2) / items.length;
  const bars = items.map((it, i) => {
    const v = it[valueKey];
    const h = ((H - PAD * 2) * v) / max;
    const x = PAD + i * bw + bw * 0.15;
    const y = H - PAD - h;
    const w = bw * 0.7;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="4"/>
      <text x="${(x + w / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="val">${v}</text>
      <text x="${(x + w / 2).toFixed(1)}" y="${H - PAD + 16}" text-anchor="middle" class="lbl">${esc(it.label)}</text>`;
  }).join("");
  return `<div class="card"><h3>${esc(title)} <span class="unit">${unit}</span></h3>
    <svg viewBox="0 0 ${W} ${H}" width="100%">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" class="axis"/>
      ${bars}
    </svg></div>`;
}

const sections = [];

if (data.models?.length) {
  const items = data.models.map((m) => ({ label: m.model.replace("claude-opus-", "opus-"), ...m }));
  sections.push(barChart("RPS per model", items, "rps", "#4f9dde", "req/s"));
  sections.push(barChart("TPM per model", items, "tpm", "#6cc070", "tokens/min"));
  sections.push(barChart("Avg latency per model", items, "avgMs", "#e0a14f", "ms"));
}

if (data.ramp?.steps?.length) {
  const items = data.ramp.steps.map((s) => ({ label: "c" + s.conc, ...s }));
  sections.push(barChart(`Ramp RPS (${data.ramp.model})`, items, "rps", "#9b7fde", "req/s"));
  sections.push(barChart(`Ramp TPM (${data.ramp.model})`, items, "tpm", "#de7fa8", "tokens/min"));
}

function table(rows) {
  const head = "<tr><th>model</th><th>conc</th><th>ok</th><th>rps</th><th>tpm</th><th>avg ms</th><th>p95 ms</th><th>errors</th></tr>";
  const body = rows.map((r) =>
    `<tr><td>${esc(r.model)}</td><td>${r.conc}</td><td>${r.ok}/${r.total}</td><td>${r.rps}</td><td>${r.tpm}</td><td>${r.avgMs}</td><td>${r.p95Ms}</td><td>${esc(JSON.stringify(r.errors))}</td></tr>`
  ).join("");
  return `<table>${head}${body}</table>`;
}

const allRows = [...(data.models || []), ...(data.ramp?.steps || [])];

const html = `<!doctype html><html><head><meta charset="utf-8"><title>routerin benchmark</title>
<style>
  body{font:14px -apple-system,Segoe UI,Roboto,sans-serif;background:#0f1117;color:#e6e8ee;margin:0;padding:32px}
  h1{margin:0 0 4px}.sub{color:#8b90a0;margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
  .card{background:#171a22;border:1px solid #232735;border-radius:12px;padding:16px}
  .card h3{margin:0 0 8px;font-size:14px}.unit{color:#8b90a0;font-weight:400;font-size:12px}
  .axis{stroke:#2a2f3d}.val{fill:#e6e8ee;font-size:11px}.lbl{fill:#8b90a0;font-size:11px}
  table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px}
  th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #232735}th{color:#8b90a0}
  td:nth-child(n+2),th:nth-child(n+2){text-align:right}
</style></head><body>
  <h1>routerin — AgentRouter benchmark</h1>
  <div class="sub">claude models · ${esc(data.generatedAt)} · cooldown ${data.cooldown}s between runs</div>
  <div class="grid">${sections.join("")}</div>
  ${table(allRows)}
</body></html>`;

writeFileSync(new URL("./bench-report.html", import.meta.url), html);
console.log("wrote scripts/bench-report.html");
