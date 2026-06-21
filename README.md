# Nikhil AI Labs — Website

A premium, neo-brutalist site for **Nikhil AI Labs** — *AI copilots for problem solving and operational excellence.*
Static, no build step, no dependencies.

## Structure

```
nikhil-ai-labs/
├── index.html                                  Homepage
├── products/
│   ├── investigation-intelligence-workbench.html
│   └── a3-coach.html
├── assets/
│   ├── site.css        Shared design system (one source of truth for all pages)
│   └── site.js         Shared interactions (nav toggle, scroll reveal, marquee)
└── README.md
```

Edit a brand color or component **once** in `assets/site.css` and it updates every page.

## Open it

Double-click **`index.html`**, or serve the folder (relative paths to `assets/` and `products/` need a server or file:// that resolves them):

```bash
python -m http.server 8137 --directory .
# http://localhost:8137
```

## Design direction

Layout simplicity + product-first messaging inspired by comma.ai, rendered in a **neo-brutalist**
visual language: thick borders, hard offset shadows (no blur), chunky type, warm cream base, one
bright accent — tuned to the brand kit so it stays credible for a pharma / GMP audience.

| Brand kit | Used for |
|-----------|----------|
| Navy `#1B2D5A` | Borders, hard shadows, headings, dark bands, footer |
| Orange `#FF6B35` (signature) | The one accent — primary CTAs, highlights, pilot bands |
| Teal `#17A2B8` | Support accents, A3 Coach identity, tinted tiles |
| Dark Gray `#333333` | Body text |
| Cream `#FBF6EC` + White | Base + cards |
| **Montserrat** (800/900) | Sole typeface — heavy weights drive the chunky display feel |

## Pages

- **Homepage** — Hero (live Workbench preview) → trust marquee → two-product showcase → Proof (navy)
  → Use Cases → Philosophy → Insights → Pilot CTA (orange) → Footer.
- **Investigation Intelligence Workbench** — Hero → Problem → Solution (navy) → Capabilities (7)
  → Designed For → Why It's Different → Pilot CTA.
- **A3 Coach** — Hero → Problem → Solution (navy) → Capabilities (7) → Designed For → Why It's Different
  → 15+ experience → Get Started CTA.

Pages cross-link (homepage cards → product pages; each product page links to its sibling).

## Engineering notes

- **Responsive** — verified at 375 / tablet / desktop. No horizontal overflow; nav collapses to a
  hamburger under 860px; product cards, capability grids, and audience pills reflow with `auto-fit`.
- **Accessibility** — semantic landmarks, visible focus rings, `aria-expanded` menu, labelled email
  input, `prefers-reduced-motion` disables animations, decorative icons `aria-hidden`. Navy-on-orange
  CTAs clear 4.5:1. All-SVG icons (no emoji).

## To make it real

- **Wire the CTAs.** Homepage pilot form (`#pilot`) is inert (`onsubmit` no-op). Product-page
  "Request Pilot" / "Book Demo" / "Try A3 Coach" currently use `mailto:hello@nikhilailabs.com`
  and `#pilot` placeholders — point "Try A3 Coach" at the live app when ready.
- Replace the placeholder LinkedIn `href="#"` and the Insights post links.
- All copy is plain text in the HTML — edit in place.
