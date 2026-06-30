/* AI 5 Why Problem Solver — homepage lead magnet.
   Calls the Netlify function for real AI; falls back to a client mock when the
   AI backend isn't configured, so the tool always works. No API keys here. */
(function () {
  const $ = (id) => document.getElementById(id);
  const genBtn = $("fwGenerate");
  if (!genBtn) return;

  const problemEl = $("fwProblem"), catEl = $("fwCategory"),
        errorEl = $("fwError"), resultCard = $("fwResultCard"), leadCard = $("fwLeadCard");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const showError = (el, msg) => { el.textContent = msg || ""; el.hidden = !msg; };

  // Quick-start chips prefill the form.
  document.querySelectorAll("#fwChips button").forEach((b) =>
    b.addEventListener("click", () => {
      problemEl.value = b.getAttribute("data-fill") || "";
      const c = b.getAttribute("data-cat"); if (c) catEl.value = c;
      showError(errorEl, ""); problemEl.focus();
    })
  );

  // Client-side mock — templated but category-aware; replaced by Claude once the
  // backend has ANTHROPIC_API_KEY set (see netlify/functions/five-why.js).
  function mockFiveWhy(problem, category) {
    const p = problem.trim().replace(/\s+/g, " ");
    const T = {
      "Quality": ["an in-process check did not catch the drift", "the acceptance limit was treated as advisory, not a hard stop", "the procedure left the limit open to interpretation", "the limit was never built into the system as an enforced control"],
      "Manufacturing": ["a process parameter drifted outside its validated range", "the equipment ran past its maintenance/usage limit", "the changeover was not standardized", "the standard was never enforced as a checkpoint"],
      "Supply Chain": ["incoming material varied lot-to-lot", "a supplier change was not flagged at receiving", "the spec gap was missed at incoming QC", "no control linked the spec to the receiving step"],
      "Safety": ["the hazard was present during the task", "the safeguard was bypassed or missing", "the procedure did not require the safeguard", "the requirement was never made a hard control"],
      "Customer Complaint": ["the delivered result did not match the customer's expectation", "the expectation was not captured up front", "the handoff lost the requirement", "no control verified the requirement before release"],
      "Other": ["the immediate trigger was not detected in time", "a contributing condition was allowed to persist", "the procedure did not prevent it", "the gap was never closed with a control"],
    };
    const t = T[category] || T.Other;
    return {
      refinedProblem: `${p}${/[.!?]$/.test(p) ? "" : "."} (Category: ${category})`,
      whys: [
        `Why did this happen? Because ${t[0]}.`,
        `Why ${t[0]}? Because ${t[1]}.`,
        `Why ${t[1]}? Because ${t[2]}.`,
        `Why ${t[2]}? Because ${t[3]}.`,
        `Why ${t[3]}? Because the underlying control or standard was missing — the root cause to test.`,
      ],
      rootCause: `Most likely: ${t[3]} — a missing or advisory control rather than a one-off mistake.`,
      confidence: "Medium — draft only. Connect the AI backend for evidence-weighted confidence.",
      missingEvidence: [
        "Objective data confirming the condition (logs, records, measurements)",
        "Whether sibling lines / batches / cases show the same signal",
        "Evidence the standard or control actually existed and was followed",
      ],
      containment: "Quarantine or hold the affected output and pause the at-risk step until the suspected control is verified.",
      nextStep: "Run a full evidence-linked 5 Why and RCA in the Investigation Intelligence Workbench, where each step ties to source evidence.",
    };
  }

  async function generate() {
    showError(errorEl, "");
    const problem = problemEl.value.trim(), category = catEl.value;
    if (problem.length < 20) { showError(errorEl, "Please describe the problem in at least 20 characters."); problemEl.focus(); return; }

    const labelEl = genBtn.querySelector(".fw-btn-label");
    genBtn.disabled = true; genBtn.classList.add("is-loading"); labelEl.textContent = "Generating…";

    let data = null;
    try {
      const res = await fetch("/.netlify/functions/five-why", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "generate", problem, category }),
      });
      const json = await res.json();
      if (json && json.configured && json.result) data = json.result;
    } catch (_) { /* backend unavailable → mock */ }
    if (!data) data = mockFiveWhy(problem, category);

    renderResult(data);
    genBtn.disabled = false; genBtn.classList.remove("is-loading"); labelEl.textContent = "Regenerate";
  }

  function renderResult(d) {
    resultCard.innerHTML =
      `<div class="fw-result-head"><span class="fw-badge">AI 5 Why draft</span><span class="fw-conf">${esc(d.confidence)}</span></div>` +
      `<h3 class="fw-h3">Refined problem</h3><p class="fw-p">${esc(d.refinedProblem)}</p>` +
      `<h3 class="fw-h3">5 Why chain</h3><ol class="fw-whys">${(d.whys || []).map((w) => `<li>${esc(w)}</li>`).join("")}</ol>` +
      `<div class="fw-grid2">` +
        `<div class="fw-mini"><h4>Likely root cause</h4><p>${esc(d.rootCause)}</p></div>` +
        `<div class="fw-mini fw-mini--warn"><h4>Immediate containment</h4><p>${esc(d.containment)}</p></div>` +
      `</div>` +
      `<h3 class="fw-h3">Missing evidence</h3><ul class="fw-list">${(d.missingEvidence || []).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` +
      `<div class="fw-mini fw-mini--next"><h4>Recommended next step</h4><p>${esc(d.nextStep)}</p></div>` +
      `<div class="fw-cta"><span>Want a deeper evidence-linked investigation?</span>` +
        `<a href="#pilot" class="btn btn--primary">Request pilot access` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>` +
        `</a></div>`;
    resultCard.hidden = false; leadCard.hidden = false;
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  genBtn.addEventListener("click", generate);

  const leadForm = $("fwLeadForm");
  if (leadForm) leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const okEl = $("fwLeadOk"), errEl = $("fwLeadError");
    okEl.hidden = true; showError(errEl, "");
    const email = $("fwEmail").value.trim();
    if (!EMAIL_RE.test(email)) { showError(errEl, "Please enter a valid work email."); $("fwEmail").focus(); return; }

    const btn = leadForm.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      const res = await fetch("/.netlify/functions/five-why", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "lead", email,
          name: $("fwName").value.trim(), company: $("fwCompany").value.trim(),
          role: $("fwRole").value.trim(), industry: $("fwIndustry").value.trim(),
          problem: problemEl.value.trim(), category: catEl.value,
        }),
      });
      if (!res.ok) throw new Error();
      okEl.hidden = false; leadForm.reset();
    } catch (_) {
      showError(errEl, "Couldn't submit just now — email hello@nikhilailabs.com and we'll send it over.");
    } finally { btn.disabled = false; }
  });
})();
