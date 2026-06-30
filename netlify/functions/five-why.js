// Backend route for the AI 5 Why Problem Solver. All AI requires ANTHROPIC_API_KEY;
// without it we return { configured:false } and the frontend uses its mock.
// - type:"next"       -> facilitator's next Why question + a coaching note (per turn)
// - type:"synthesize" -> assess the user's own completed 5-Why chain
// - type:"generate"   -> legacy one-shot draft (older cached clients)
// - type:"lead"       -> captures the lead. API key never reaches the browser.
const json = (status, obj) => ({ statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Embedded Lean Six Sigma 5-Why practitioner discipline — the knowledge layer
// that makes the facilitator behave like a Master Black Belt.
const LEAN_5WHY =
  "You are a Lean Six Sigma Master Black Belt facilitating a disciplined 5 Why. Apply this method strictly: " +
  "(1) a valid 'why' is a cause that is necessary for the prior effect and verifiable with evidence — not an opinion, guess, or restatement; " +
  "(2) probe across three tracks — why it occurred, why it was not detected, and why the system/standard allowed it — and steer toward the systemic track; " +
  "(3) a root cause is a missing or weak process/system control or standard the organisation can act on, never a symptom; " +
  "(4) reject blame — 'human error', 'operator forgot', 'someone didn't' is never a root cause; ask what condition or missing safeguard made it likely; " +
  "(5) reject vague causes like 'lack of training/communication/attention' — force a specific, concrete mechanism; " +
  "(6) a missing countermeasure ('no checklist') is not the root cause — ask why it was absent or unused; " +
  "(7) watch for multiple parallel causes and note when a branch likely exists; " +
  "(8) validate the chain by reading it back bottom-up with 'therefore'. Never claim proof without data.";

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

  const chain = Array.isArray(body.chain) ? body.chain.filter((c) => c && c.a).slice(0, 8) : [];

  // next -> facilitator picks the sharpest next Why + coaches the last answer.
  if (body.type === "next") {
    if (!chain.length) return json(422, { error: "missing chain" });
    try {
      return json(200, { configured: true, result: await claudeNext(key, problem, category, chain) });
    } catch (e) {
      return json(200, { configured: false, error: String(e) }); // fail safe -> frontend heuristics
    }
  }

  // synthesize -> assess the user's OWN completed 5-Why chain.
  if (body.type === "synthesize") {
    if (!chain.length) return json(422, { error: "missing chain" });
    try {
      return json(200, { configured: true, result: await claudeSynthesise(key, problem, category, chain) });
    } catch (e) {
      return json(200, { configured: false, error: String(e) }); // fail safe -> frontend mock
    }
  }

  try {
    return json(200, { configured: true, result: await claudeFiveWhy(key, problem, category) });
  } catch (e) {
    return json(200, { configured: false, error: String(e) }); // fail safe -> frontend mock
  }
};

function chainToText(chain) {
  return chain.map((c, i) => `${i + 1}. ${c.q}\n   Answer: ${c.a}`).join("\n");
}

async function claudeNext(key, problem, category, chain) {
  const system = LEAN_5WHY + " You are mid-interview. Return ONLY JSON.";
  const user =
    `Problem (category: ${category}): ${problem}\n\n` +
    `The 5 Why chain so far (the user wrote the answers):\n${chainToText(chain)}\n\n` +
    `Decide the single best NEXT "Why" question — build on their most recent answer and steer toward a systemic root cause; if their answer is blame, vague, a guess, or a solution-disguised-as-cause, ask a question that redirects to the real cause. ` +
    `Also give ONE short coaching note (max 18 words, prefix it with "Coach: ") reacting to that most recent answer, or null if it's already solid. ` +
    `Set atRoot true only if their most recent answer already states an actionable systemic/process root cause (a missing or weak standard, control, or system).\n` +
    `Return strictly: {"question":string,"coach":string|null,"atRoot":boolean}`;
  return callClaude(key, system, user, 400);
}

async function claudeSynthesise(key, problem, category, chain) {
  const system = LEAN_5WHY + " You are reviewing a 5 Why chain the user wrote themselves — do NOT rewrite their answers; assess them. Return ONLY JSON.";
  const user =
    `Problem (category: ${category}): ${problem}\n\n` +
    `The user's own 5 Why chain:\n${chainToText(chain)}\n\n` +
    `Return strictly this JSON shape:\n` +
    `{"refinedProblem":string,` +
    `"rootCause":string (deepest testable cause their chain points to; add a one-line caution if a step looks weak or blame-based),` +
    `"rootCauseType":string (exactly one of: "Systemic / process control", "Detection gap", "Occurrence-specific", "Symptom — not yet a root cause"),` +
    `"confidence":string (how solid their chain is, and why),` +
    `"verification":string (a read-back test: if the named root cause were removed, would the problem stop? name what to check to confirm),` +
    `"missingEvidence":[2-4 strings],"containment":string,"nextStep":string}`;
  return callClaude(key, system, user, 1300);
}

async function claudeFiveWhy(key, problem, category) {
  const system = LEAN_5WHY + " Produce a disciplined 5 Why root-cause DRAFT for the problem. Return ONLY JSON.";
  const user =
    `Problem (category: ${category}): ${problem}\n\n` +
    `Return strictly this JSON shape:\n` +
    `{"refinedProblem":string,"whys":[exactly 5 strings, each a full "Why … because …" step],` +
    `"rootCause":string,"confidence":string,"missingEvidence":[2-4 strings],` +
    `"containment":string,"nextStep":string}`;
  return callClaude(key, system, user, 1300);
}

async function callClaude(key, system, user, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: maxTokens,
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
