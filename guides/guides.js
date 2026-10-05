/* Guides: one common landing page, one Kit form, one PDF per guide.
   - /guides/            lists every guide
   - /guides/?g=<slug>   the email gate for that guide only
   The email goes to Kit first (form 10005146, tagged by guide via the referrer URL);
   only after Kit accepts it does the page reveal that guide's PDF.

   To add a guide: drop the PDF in files/ (with a random suffix in the name), its
   page-1 image in covers/, and add one entry below. Nothing to change in Kit. */

const KIT_FORM = "https://app.kit.com/forms/10005146/subscriptions";

const GUIDES = [
  {
    slug: "soas",
    meta: "Free quick reference · 3 pages",
    title: "SOAS: optimize before you automate",
    card: "Standardize, Optimize, Automate, Sustain: the order that stops you digitizing waste.",
    lead: "Most factories don't have an AI problem. They have a sequence problem. This quick reference shows the four stages in order and gives you a test to run on any automation request before you approve it.",
    inside: [
      "The 4 SOAS stages, each with its key question, its output and the common trap",
      "An exit gate for every stage: when it's done and what evidence to ask for",
      "A worked example and a self-check for automating too early",
      "The SOAS test: a worksheet to score one automation request and decide",
    ],
    cover: "covers/soas.png",
    pdf: "files/soas-quick-reference-29ef137b.pdf",
  },
  {
    slug: "inside-out",
    meta: "Free guide · 3 pages",
    title: "AI pays off from the inside out",
    card: "Five layers every AI pilot in a plant stands on, and how to tell which one yours skipped.",
    lead: "Most AI pilots in manufacturing don't fail at the AI. They fail on a layer underneath it. This guide shows the build order and helps you score your own project.",
    inside: [
      "The 5 layers (Mindset, Process, Data, People, Scale), each with what scales, what stalls and the output to have",
      "\"Where is your project really stuck?\": six things you hear in reviews, mapped to the missing layer",
      "A gate check and a self-check for building from the outside in",
      "A one-page scorecard to run on your own pilot, with a 30-day re-score",
    ],
    cover: "covers/ai-inside-out.png",
    pdf: "files/ai-inside-out-guide-6952c1fe.pdf",
  },
  {
    slug: "yokoten",
    meta: "Free workbook · 4 pages",
    title: "Yokoten: solve it once, prevent it everywhere",
    card: "Spread a proven fix to every line, shift and site where the same failure could happen.",
    lead: "Most problems in your plant have already been solved, just not in your building. This workbook turns one lesson into a company-wide standard.",
    inside: [
      "The 5-step Yokoten method, with the output and the common trap for each step",
      "Six \"where else?\" lenses for finding the same failure at a different address",
      "The lesson card: a worksheet to capture the why, not just the fix",
      "The adoption tracker: close the loop, line by line and site by site",
    ],
    cover: "covers/yokoten.png",
    pdf: "files/yokoten-workbook-a6ae9281.pdf",
  },
  {
    slug: "hoshin-kanri",
    meta: "Free quick reference · 4 pages",
    title: "Hoshin Kanri: strategy fails on the way down",
    card: "Turn one vision into the right next move for every team, and get results flowing back up.",
    lead: "A practical quick reference for deploying strategy with catchball and PDCA, with a one-page plan you can fill in with your leadership team.",
    inside: [
      "The 5 steps, each with its output and the common trap",
      "A catchball example: one KPI restated at four levels",
      "A review rhythm and a self-check for strategy that fails on the way down",
      "A fill-in worksheet: your Hoshin plan on one page",
    ],
    cover: "covers/hoshin-kanri.png",
    pdf: "files/hoshin-kanri-quick-reference-9846b263.pdf",
  },
];

(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const guide = GUIDES.find((g) => g.slug === params.get("g"));

  const card = (g) => `
    <article class="g-card">
      <a class="g-card__cover" href="?g=${g.slug}" aria-hidden="true" tabindex="-1"><img src="${g.cover}" alt="" loading="lazy" width="745" height="1054"></a>
      <div class="g-card__body">
        <span class="g-meta">${g.meta}</span>
        <h3>${g.title}</h3>
        <p>${g.card}</p>
        <a class="btn btn--primary" href="?g=${g.slug}">Get the free guide</a>
      </div>
    </article>`;

  if (!guide) {
    $("all").hidden = false;
    $("allGrid").innerHTML = GUIDES.map(card).join("");
    if (params.get("confirmed")) $("gConfirmed").style.display = "block";
    return;
  }

  // One guide: show only this one. Its PDF link is not in the page until the email is accepted.
  document.title = `${guide.title} (free) — Nikhil AI Labs`;
  $("one").hidden = false;
  $("oneMeta").textContent = guide.meta;
  $("oneTitle").textContent = guide.title;
  $("oneLead").textContent = guide.lead;
  $("oneCover").src = guide.cover;
  $("oneCover").alt = `Page 1 of the ${guide.title} guide`;
  $("oneInside").innerHTML = guide.inside.map((t) => `<li>${t}</li>`).join("");
  const others = GUIDES.filter((g) => g !== guide);
  if (others.length) { $("more").hidden = false; $("moreGrid").innerHTML = others.map(card).join(""); }

  const form = $("gForm"), btn = $("gBtn"), err = $("gErr"), email = $("gEmail");
  const fail = (msg) => { err.textContent = msg; err.style.display = "block"; btn.disabled = false; btn.textContent = "Get the free guide"; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.style.display = "none";
    const value = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return fail("Please enter a valid email address.");
    btn.disabled = true; btn.textContent = "Sending…";
    const body = new FormData();
    body.append("email_address", value);
    body.append("referrer", `https://nikhilailabs.com/guides/?g=${guide.slug}`);
    try {
      const res = await fetch(KIT_FORM, { method: "POST", body, headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "success") return fail("That didn't go through. Please check the address and try again.");
    } catch (_) {
      return fail("Couldn't reach the sign-up service. Please try again in a moment.");
    }
    // Email accepted by Kit: now, and only now, reveal this guide's PDF.
    $("gDownload").href = guide.pdf;
    $("gDownload").setAttribute("download", guide.pdf.split("/").pop().replace(/-[0-9a-f]{8}\.pdf$/, ".pdf"));
    form.style.display = "none";
    $("gDone").style.display = "block";
    if (window.gtag) gtag("event", "generate_lead", { guide: guide.slug });
  });
})();
