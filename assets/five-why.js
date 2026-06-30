/* AI 5 Why Problem Solver — Lean Six Sigma guided interview.
   Asks one Why at a time. When the backend has ANTHROPIC_API_KEY, a Master
   Black Belt facilitator (Claude) writes each next question + a coaching note
   and synthesises the root cause. Without a key, client heuristics mirror the
   same LSS discipline so the interview never stalls. No API keys here. */
(function () {
  const $ = (id) => document.getElementById(id);
  const startBtn = $("fwGenerate");
  if (!startBtn) return;

  const EP = "/.netlify/functions/five-why";
  const problemEl = $("fwProblem"), catEl = $("fwCategory"), errorEl = $("fwError");
  const interviewCard = $("fwInterviewCard"), resultCard = $("fwResultCard"),
        leadCard = $("fwLeadCard");
  const MAX_WHYS = 5;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const showError = (el, msg) => { if (el) { el.textContent = msg || ""; el.hidden = !msg; } };

  let state = { problem: "", category: "Other", chain: [], atRoot: false }; // chain: [{ q, a, coach }]
  const FIRST_Q = "Why did this happen?";

  // Fallback next-Why: restate the user's last answer. The Claude facilitator
  // replaces this with a sharper, symptom-busting question when configured.
  const nextQuestion = (answer) =>
    `Why ${answer.trim().replace(/^because\s+/i, "").replace(/[.?!]+$/, "")}?`;

  // ponytail: thin keyword net for the offline coach — Claude's "next" route is
  // the real facilitator. Encodes the three classic 5-Why failure modes.
  function heuristicCoach(answer) {
    const a = answer.toLowerCase();
    if (/\bhuman error\b/.test(a) || /\b(operator|technician|worker|employee|someone|staff|nurse|analyst|person)\b[^.]*\b(error|mistake|forgot|failed|didn'?t|did not|neglig)/.test(a))
      return "Coach: that names a person, not a cause. Ask what made the error easy to make.";
    if (/\b(lack of|no|poor|insufficient|inadequate|not enough)\s+(training|communication|attention|awareness|focus|oversight)\b/.test(a))
      return "Coach: that's broad. Push for the specific standard, signal, or control that was missing.";
    if (/\bbecause\s+(we|they|i)\s+(didn'?t|did not|never|hadn'?t|haven'?t|don'?t)\s+(have|use|create|make|build|implement|put|follow)\b/.test(a))
      return "Coach: that's a missing countermeasure, not yet the cause. Why was it missing or not used?";
    return null;
  }
  // ponytail: rough systemic-cause signal; Claude sets atRoot precisely when on.
  function heuristicAtRoot(answer) {
    const a = answer.toLowerCase();
    return /\b(standard|procedure|sop|control|system|policy|design|spec|process)\b/.test(a) &&
           /\b(missing|no |not |never|absent|weak|unclear|undefined|outdated|out of date|wasn'?t|isn'?t|don'?t)\b/.test(a);
  }

  // Quick-start chips prefill the problem.
  document.querySelectorAll("#fwChips button").forEach((b) =>
    b.addEventListener("click", () => {
      problemEl.value = b.getAttribute("data-fill") || "";
      const c = b.getAttribute("data-cat"); if (c) catEl.value = c;
      showError(errorEl, ""); problemEl.focus();
    })
  );

  function start() {
    showError(errorEl, "");
    const problem = problemEl.value.trim();
    if (problem.length < 20) { showError(errorEl, "Please describe the problem in at least 20 characters."); problemEl.focus(); return; }
    state = { problem, category: catEl.value, chain: [], atRoot: false };
    resultCard.hidden = true; leadCard.hidden = true;
    interviewCard.hidden = false;
    renderStep(FIRST_Q, "");
    interviewCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderStep(question, prefill) {
    const step = state.chain.length + 1;
    const answered = state.chain.map((c, i) =>
      `<li class="fw-step"><span class="fw-step-n">${i + 1}</span><div>` +
        `<p class="fw-step-q">${esc(c.q)}</p>` +
        `<p class="fw-step-a">${esc(c.a)}</p>` +
        (c.coach ? `<p class="fw-step-coach">${esc(c.coach)}</p>` : "") +
      `</div></li>`
    ).join("");
    const canFinish = state.chain.length >= 2;
    const atRoot = state.atRoot && canFinish;
    interviewCard.innerHTML =
      `<div class="fw-result-head"><span class="fw-badge">Lean 5 Why</span><span class="fw-conf">Why ${step} of ${MAX_WHYS}</span></div>` +
      `<p class="fw-iv-problem"><b>Problem:</b> ${esc(state.problem)}</p>` +
      (answered ? `<ol class="fw-steps">${answered}</ol>` : "") +
      (atRoot ? `<p class="fw-atroot">You may have reached a systemic root cause — keep going to test it, or summarise now.</p>` : "") +
      `<div class="fw-iv-current">` +
        `<label class="fw-label" for="fwAnswer">${esc(question)}</label>` +
        `<textarea id="fwAnswer" class="fw-control fw-textarea" rows="2" placeholder="Because…"></textarea>` +
        `<p class="fw-error" id="fwAnswerError" hidden></p>` +
      `</div>` +
      `<div class="fw-iv-nav">` +
        `<button type="button" class="btn" id="fwBack"${state.chain.length ? "" : " disabled"}>← Back</button>` +
        (canFinish ? `<button type="button" class="btn btn--navy" id="fwFinish">Found root cause — summarise</button>` : "") +
        `<button type="button" class="btn btn--primary" id="fwNext">${step >= MAX_WHYS ? "Summarise" : "Next why"} →</button>` +
      `</div>`;

    const answerEl = $("fwAnswer");
    answerEl.value = prefill || "";
    answerEl.dataset.q = question;
    answerEl.focus();
    answerEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) advance(false); });
    $("fwNext").addEventListener("click", () => advance(false));
    $("fwBack").addEventListener("click", back);
    if ($("fwFinish")) $("fwFinish").addEventListener("click", () => advance(true));
  }

  async function advance(finish) {
    const answerEl = $("fwAnswer"), answer = answerEl.value.trim();
    if (answer.length < 3) { showError($("fwAnswerError"), "Add a short answer (the “because…”) to continue."); answerEl.focus(); return; }
    state.chain.push({ q: answerEl.dataset.q, a: answer, coach: null });
    if (finish || state.chain.length >= MAX_WHYS) return synthesize();

    const nextBtn = $("fwNext"); nextBtn.disabled = true; nextBtn.textContent = "Thinking…";
    $("fwBack").disabled = true; if ($("fwFinish")) $("fwFinish").disabled = true;

    const nx = await getNext();
    state.chain[state.chain.length - 1].coach = nx.coach;
    state.atRoot = nx.atRoot;
    renderStep(nx.question, "");
  }

  // The LSS facilitator's next move — AI when configured, heuristics otherwise.
  async function getNext() {
    const last = state.chain[state.chain.length - 1].a;
    try {
      const res = await fetch(EP, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "next", problem: state.problem, category: state.category, chain: state.chain }),
      });
      const json = await res.json();
      if (json && json.configured && json.result && json.result.question)
        return { question: json.result.question, coach: json.result.coach || null, atRoot: !!json.result.atRoot };
    } catch (_) { /* fall through to heuristics */ }
    return { question: nextQuestion(last), coach: heuristicCoach(last), atRoot: heuristicAtRoot(last) };
  }

  function back() {
    if (!state.chain.length) return;
    const last = state.chain.pop();
    state.atRoot = false;
    renderStep(last.q, last.a);
  }

  async function synthesize() {
    interviewCard.innerHTML =
      `<div class="fw-result-head"><span class="fw-badge">Lean 5 Why</span><span class="fw-conf">Reviewing your chain…</span></div>` +
      `<p class="fw-iv-problem">A Lean Six Sigma facilitator is reviewing the ${state.chain.length} answers you gave…</p>` +
      `<div class="fw-spinner" role="status" aria-label="Analysing"></div>`;

    let data = null;
    try {
      const res = await fetch(EP, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "synthesize", problem: state.problem, category: state.category, chain: state.chain }),
      });
      const json = await res.json();
      if (json && json.configured && json.result) data = json.result;
    } catch (_) { /* backend unavailable → mock */ }
    if (!data) data = mockSynthesis();
    renderResult(data);
  }

  // Client mock — summarises the user's own chain with LSS framing; replaced by
  // Claude once the backend has ANTHROPIC_API_KEY (see netlify/functions/five-why.js).
  function mockSynthesis() {
    const root = state.chain[state.chain.length - 1].a;
    return {
      refinedProblem: `${state.problem}${/[.!?]$/.test(state.problem) ? "" : "."} (Category: ${state.category})`,
      rootCause: `The deepest cause your chain reaches: “${root}.” Confirm it's a missing or weak control — not a one-off mistake — before acting on it.`,
      rootCauseType: heuristicAtRoot(root) ? "Systemic / process control" : "Symptom — likely not the root cause yet",
      confidence: "Medium — based on your inputs only. Connect the AI backend for evidence-weighted facilitation.",
      verification: `Read it back bottom-up: if “${root}” were fixed, would the original problem stop? If not, you've stopped at a symptom — keep asking why.`,
      missingEvidence: [
        "Objective data confirming each step (logs, records, measurements)",
        "Whether sibling lines / batches / cases show the same signal",
        "Evidence the standard or control actually existed and was followed",
      ],
      containment: "Quarantine or hold the affected output and pause the at-risk step until the suspected control is verified.",
      nextStep: "Run a full evidence-linked 5 Why and RCA in the Investigation Intelligence Workbench, where each step ties to source evidence.",
    };
  }

  function renderResult(d) {
    interviewCard.hidden = true;
    const whys = state.chain.map((c) =>
      `<li><span class="fw-why-q">${esc(c.q)}</span> <span class="fw-why-a">${esc(c.a)}</span></li>`
    ).join("");
    resultCard.innerHTML =
      `<div class="fw-result-head"><span class="fw-badge">Lean 5 Why summary</span><span class="fw-conf">${esc(d.confidence)}</span></div>` +
      `<h3 class="fw-h3">Refined problem</h3><p class="fw-p">${esc(d.refinedProblem)}</p>` +
      `<h3 class="fw-h3">Your 5 Why chain</h3><ol class="fw-whys">${whys}</ol>` +
      `<div class="fw-grid2">` +
        `<div class="fw-mini"><h4>Likely root cause</h4>` +
          (d.rootCauseType ? `<span class="fw-rc-type">${esc(d.rootCauseType)}</span>` : "") +
          `<p>${esc(d.rootCause)}</p></div>` +
        `<div class="fw-mini fw-mini--warn"><h4>Immediate containment</h4><p>${esc(d.containment)}</p></div>` +
      `</div>` +
      (d.verification ? `<div class="fw-mini fw-mini--check"><h4>Validate the chain</h4><p>${esc(d.verification)}</p></div>` : "") +
      `<h3 class="fw-h3">Missing evidence</h3><ul class="fw-list">${(d.missingEvidence || []).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` +
      `<div class="fw-mini fw-mini--next"><h4>Recommended next step</h4><p>${esc(d.nextStep)}</p></div>` +
      `<div class="fw-cta"><span>Want a deeper evidence-linked investigation?</span>` +
        `<a href="#pilot" class="btn btn--primary">Request pilot access` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>` +
        `</a></div>`;
    resultCard.hidden = false; leadCard.hidden = false;
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  startBtn.addEventListener("click", start);

  const leadForm = $("fwLeadForm");
  if (leadForm) leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const okEl = $("fwLeadOk"), errEl = $("fwLeadError");
    okEl.hidden = true; showError(errEl, "");
    const email = $("fwEmail").value.trim();
    if (!EMAIL_RE.test(email)) { showError(errEl, "Please enter a valid work email."); $("fwEmail").focus(); return; }

    const btn = leadForm.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      const res = await fetch(EP, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "lead", email,
          name: $("fwName").value.trim(), company: $("fwCompany").value.trim(),
          role: $("fwRole").value.trim(), industry: $("fwIndustry").value.trim(),
          problem: state.problem, category: state.category, chain: state.chain,
        }),
      });
      if (!res.ok) throw new Error();
      okEl.hidden = false; leadForm.reset();
    } catch (_) {
      showError(errEl, "Couldn't submit just now — email hello@nikhilailabs.com and we'll send it over.");
    } finally { btn.disabled = false; }
  });
})();
