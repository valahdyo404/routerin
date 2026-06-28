import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { BASE_URL, ANTHROPIC_VERSION, CLIENT_UA } from "./config.js";

export function pickRequest(protocol) {
  return protocol === "http:" ? httpRequest : httpsRequest;
}

export function classify(buf) {
  if (buf.includes("message_start")) return { ok: true };
  if (/unauthorized client|unauthenticated/i.test(buf)) return { ok: false, gate: true };
  if (/insufficient|额度不足/i.test(buf)) return { ok: false, quota: true };
  if (/TPM|rate.?limit/i.test(buf)) return { ok: true, authed: true, note: "rate limited" };
  return { ok: false };
}

export function testConnection(key, model, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + "/v1/messages");
    const send = pickRequest(url.protocol);
    const body = JSON.stringify({
      model,
      max_tokens: 30,
      stream: true,
      messages: [{ role: "user", content: "say OK" }]
    });

    const req = send(
      url,
      {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
          "user-agent": CLIENT_UA,
          "x-app": "cli"
        }
      },
      (res) => {
        let buf = "";
        res.on("data", (chunk) => {
          buf += chunk.toString();
          if (buf.includes("event: message_start")) {
            req.destroy();
            resolve({ ok: true, status: res.statusCode });
          }
        });
        res.on("end", () => {
          const c = classify(buf);
          resolve(c.ok ? { ...c, status: res.statusCode } : { ...c, status: res.statusCode, body: buf.slice(0, 400) });
        });
      }
    );

    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.write(body);
    req.end();
  });
}
