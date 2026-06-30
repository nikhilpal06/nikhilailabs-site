// Backend route for the AI 5 Why Problem Solver.
// - type:"generate" -> real Claude analysis if ANTHROPIC_API_KEY is set,
//   otherwise returns { configured:false } and the frontend uses its mock.
// - type:"lead"     -> captures the lead. API key never reaches the browser.
const json = (status, obj) => ({ statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "invalid json" }); }

  if (body.type === "lead") {
    const email = String(body.email || "").trim();
    if (!EMAIL_RE.test(email)) return json(422, { error: "invalid email" });
    // ponytail: leads land in the function logs for now. Wire to Kit or forward to
    // app.nikhilailabs.com/api/assessment/lead before you rely on this for capture.
    console.log("[5why-lead]", JSON.stringify({ ...body, ts: new Date().toISOString() }));
    return json(200, { ok: true });
  }

  const problem = String(body.problem || "").trim();
  const category = String(body.category || "Other");
  if (problem.length < 20) return json(422, { error: "problem too short" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(200, { configured: false }); // frontend renders its mock

  try {
    return json(200, { configured: true, result: await claudeFiveWhy(key, problem, category) });
  } catch (e) {
    return json(200, { configured: false, error: String(e) }); // fail safe -> frontend mock
  }
};

async function claudeFiveWhy(key, problem, category) {
  const system = "You are a Lean Six Sigma master black belt producing a disciplined 5 Why root-cause DRAFT for an operational problem. Be specific, evidence-aware, and testable — never claim proof without data. Return ONLY JSON.";
  const user =
    `Problem (category: ${category}): ${problem}\n\n` +
    `Return strictly this JSON shape:\n` +
    `{"refinedProblem":string,"whys":[exactly 5 strings, each a full "Why … because …" step],` +
    `"rootCause":string,"confidence":string,"missingEvidence":[2-4 strings],` +
    `"containment":string,"nextStep":string}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 1300,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error("anthropic " + res.status);
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
}
