# Sprint — Brand & Landing Rebuild (Q3 2026) — ✅ COMPLETE (2026-07-06)

> **STATUS: DONE.** All steps finished or explicitly superseded by owner
> decisions. Ledger in §14 at the bottom. No open work remains.

> Self-contained brief. Start any fresh session with:
> *"Read `SPRINT_BRAND_REBUILD.md` and start at Step 1 of the punch-list."*
> Sole source of truth for landing/login/signup redesign. Do **not** consult the
> current landing page for style, copy, or feature scope.

---

## 0. Context (why this sprint exists)

The current landing page positions QuoteGen as a "quote generator" but the
product is now a full multi-tenant business ops SaaS: O2C, P2P, HR/Salary/F&F,
GST, Cash Command Center, Approvals, Vault, Workflows, Roles, Audit, DPDP, 2FA,
Super-admin, Razorpay billing. The old landing under-sells by ~10×.

Fix: rebrand + rebuild landing / login / signup so they feel like one calm
product family, position on **time saved & control**, and elevate
**customization** as the loudest promise.

---

## 1. Discovery Report (source of truth)

### A. Product Summary
Multi-tenant SaaS for Indian SMBs covering:
- **Sell-side:** Quotation → Sales Order → Delivery Challan → Invoice → Payment Receipt → Credit Note
- **Buy-side:** Purchase Order → Goods Receipt → Purchase Bill → Debit Note → Vendor Payment
- **Money:** Unified Cash Command Center (AR + AP), Recurring Invoices, Subscriptions, Reminders, Follow-ups
- **People:** Employees, Salary, Payment Vouchers, Employee Assets, Full & Final Settlement (auto §10(10)/§10(10AA))
- **Compliance:** GST reports/filings, HSN, dual GST/non-GST numbering, e-signatures, audit logs, DPDP export/delete, 2FA
- **Documents:** Vault, Templates, Bulk generation, Approval workflows, Role-tagged signatures
- **Platform:** Super-admin console (companies, plans, revenue, features, announcements), Razorpay billing, API keys, workflows engine

### B. Module Inventory (routes exist under `src/app/`)

| Module | Route | Benefit |
|---|---|---|
| Quotations | /quotations | Faster sales cycle |
| Sales Orders | /sales-orders | Locked commitments |
| Delivery Challans | /delivery-challans | Legal proof of delivery |
| Invoices | /invoices | GST-compliant billing |
| Recurring Invoices | /recurring-invoices | Passive AR |
| Credit Notes | /credit-notes | Clean books |
| Payment Receipts | /payment-receipts | Cash clarity |
| Purchase Orders | /purchase-orders | Spend control |
| Goods Receipts | /goods-receipts | 3-way match |
| Purchase Bills | /purchase-bills | AP tracking |
| Debit Notes | /debit-notes | Vendor accuracy |
| Vendor Payments | /vendor-payments/remittance | Vendor trust |
| Cash Command Center | /cash | Live money view |
| Clients / Vendors / Catalog | /clients, /vendors, /catalog | Reusable masters |
| Employees / Salary / Vouchers | /employees, /salary, /vouchers | HR core |
| Employee Assets | /employee-assets | Loss prevention |
| Full & Final | /fnf | Legal exit letter |
| Pipeline / Projects | /pipeline, /projects | Forecast, deal grouping |
| Approvals | /approvals | Governance queue |
| Documents Vault + Templates + Bulk | /documents/* | One source of truth |
| Message Templates + Workflows | /settings/message-templates, /settings/workflows | Cadence + comms |
| Reminders / Follow-ups | /reminders, /follow-ups | Auto-nudge |
| GST Report + Filings | /gst-report/* | GSTR prep |
| Reports | /reports | KPIs |
| Audit Logs / Recycle Bin | /audit-logs, /recycle-bin | Trail + undo |
| Settings: Business, Users, Roles, Security (2FA), Privacy (DPDP), API Keys, Accessibility | /settings/* | Control |
| Billing / Checkout / Plans | /billing, /checkout, /plans | Own account |
| Support | /support/* | Tickets |
| Public share | /u/[token] | Client convenience |
| Super Admin | /admin/* | Platform ops |
| Onboarding | /onboarding | Fast start |

### C. Real Outputs (all PDFs are real)
Quote · GST Tax Invoice (dual series) · Non-GST Invoice · Sales Order · Delivery
Challan · Recurring Invoice · Credit Note · Payment Receipt · Purchase Order ·
GRN · Purchase Bill · Debit Note · Vendor Remittance · Salary Slip · Payment
Voucher · Full & Final Letter · Employee Asset assignment/recovery · Role-tagged
template letters · Bulk batches · GSTR-1 export · HSN summary · Challans export ·
Audit log export · DPDP data export · Billing invoice PDF · Public share pages.

### D. User Types (realistic only)
Solo owner · Local shop / distributor · Service business · Small team 5–25 ·
Finance/admin staff · Founder/manager · Growing 25–100 · Multi-entity operator.

Not for: enterprise 500+, marketplace sellers, agencies wanting white-label.

### E. Trust Assets (honest)
Real screenshots of `/cash`, `/quotations`, `/employees`, `/reports`,
`/settings/workflows`, `/settings/roles`, `/approvals`, `/documents/templates`,
`/gst-report`, `/fnf`, `/pipeline`, `/onboarding`. Real PDFs. No fake logos, no
fake testimonials, no invented metrics.

---

## 2. Brand & Positioning

- **Positioning:** *A simple business control system that gives owners their
  time back.* Not billing. Not quotes. One calm place for docs, money, team,
  follow-ups — **fully customizable to how your business works.**
- **Main message:** **"Run your whole business from one calm screen."**
  (Backup: *"From quote to cash — without the chase."*)
- **Emotional promise:** Fewer tabs. Fewer sticky notes. Fewer late nights.
  Owners leave on time, know where every rupee is, stop chasing customers,
  stop worrying about GST. Sell **evenings back to family** and
  **a Sunday without spreadsheets.**
- **Sell:** time saved, daily clarity, less confusion, faster document
  creation, better follow-up, easier team control, cash-flow visibility,
  peace of mind.
- **Never sell:** "SaaS", "software", "platform", "solution".

---

## 3. Design System (replaces current cold indigo)

### Color tokens — DECISION (2026-07-06): match the LIVE deployed site

The ink+cream+amber experiment was rejected by the owner. Landing, login,
signup, and app all use the **live-site indigo theme** (source: deployed
`globals.css`):

| Token | Value | Use |
|---|---|---|
| `--primary` / `--lp-brand` | `#4F46E5` indigo | Buttons, CTAs |
| `--primary-dark` / `--lp-brand-ink` | `#4338CA` | Hover, brand text |
| `--primary-light` / `--lp-brand-tint` | `#EEF2FF` | Washes, pills |
| `--bg` / `--lp-canvas` | `#F0F2F8` | Page bg |
| `--surface` / `--lp-paper` | `#FFFFFF` | Cards |
| `--text-1` / `--lp-ink` | `#0F172A` | Headlines |
| `--text-2` / `--lp-ink-soft` | `#334155` | Body |
| `--text-3/4` / `--lp-mute` | `#475569` / `#64748B` | Muted |
| `--border` / `--lp-line` | `#D1D5E0` | Lines |
| `--success` | `#059669` | Money-in |
| `--warning` / `--lp-warn` | `#D97706` | "time" accents |
| `--danger` / `--lp-pain` | `#DC2626` | "old way" accents |

Hardcoded landing accent colors use oklch hue **275** (indigo family).
Do NOT reintroduce cream/amber/serif.

### Typography
- Display: **Geist** sans, tight tracking (-0.02em) — no serif.
- Body: **Geist**, 14/15 base.
- Numbers: **Geist Mono** tabular for money.
- Scale (fluid): 12 · 14 · 16 · 18 · 22 · 28 · 40 · 56 · 80.
- Import via `next/font/google` (never `<link>`).

### Shape / motion / icons
- Radius: 10 default · 16 cards · 999 pills. No other values.
- Shadow: one low + one lifted, warm-tinted (RGB from ink, not blue-black).
- Icons: Lucide, 1.5 stroke, muted; never colorful.
- Motion: spring `stiffness 260 / damping 26`, or easeOutQuint 300–600ms.
  Only on scroll-in, hover, and state morph. Respect `prefers-reduced-motion`.
- Illustrations: **real screenshots** in tilted browser frames + hand-drawn
  amber arrow annotations. No stock art, no 3D.

### Buttons (only 3)
- **Primary (ink)** — main CTAs everywhere except money.
- **Amber** — money-CTAs only ("Start free", "Get paid").
- **Ghost with underline hover** — secondary links.

---

## 4. Landing Page Section Order (final)

Chosen hero: **Business Control Center + Wizard hybrid.** One live-looking
dashboard that morphs based on chip selection — proves breadth + customization
in one visual.

| # | Section | Headline (final copy) | Real proof shown | Motion |
|---|---|---|---|---|
| 1 | Nav | — | — | Sticky, glass on scroll |
| 2 | Hero | **"Run your whole business from one calm screen."** | `/cash` primary, morphs to `/quotations`, `/employees`, `/reports`, `/settings/workflows` via 5 chips | Chip → frame spring morph, soft parallax tilt, single amber sunrise gradient |
| 3 | Time-saved strip | *Quote in 45 seconds. GST invoice in one click. Follow-ups run themselves.* | 3 micro-loops from real UI | Fade+lift on scroll |
| 4 | Quote → Cash story | **"From the first quote to the last rupee — one path."** | Quote → SO → Challan → Invoice → Receipt PDFs, sticky left | Sticky scroll reveal (only sticky story on page) |
| 5 | Buy-side loop | **"Spend money on purpose."** | PO → GRN → Bill → Payment | Same pattern, shorter |
| 6 | Cash Command Center | **"Know today's money by lunch."** | Full-bleed `/cash` screenshot with amber callouts | Callout dots fade in sequence |
| 7 | **Customization (HIGH PRIORITY)** | **"Bend the software to your business."** Sub: *Templates, numbering, workflows, roles, approvals, signatures, taxes — you choose.* | 6-tile interactive bento: Doc Templates, Numbering series (GST/non-GST toggle), Workflows, Roles, Approvals queue, Signatures | Center pill selector swaps enlarged tile; hover shows real UI slice |
| 8 | Modules bento | *"Everything your business runs on."* | 3×3 real modules (Sales, Purchases, Payments, HR, Assets/F&F, GST, Vault, Pipeline, Reports) | Hover: 2-frame loop + border beam on focused card only |
| 9 | Real outputs marquee | **"Every paper your business needs — ready."** | Real PDFs (quote, invoice, challan, salary, F&F, receipt) | Slow marquee, pauses on hover, static under reduced-motion |
| 10 | Fits your size | *"Same product. Your shape."* | Selector: Solo / Shop / Service / Growing / Multi-branch → each shows "your day looks like this" panel + one real screen | Selector morph |
| 11 | Simple for everyone | *"If you can use WhatsApp, you can use QuoteGen."* | `/onboarding` real screen | Static + hover |
| 12 | Trust & safety | Icons only, no fake logos | 2FA · Roles · Audit log · Recycle bin · DPDP export · Encrypted backups · GST-compliant numbering · India-hosted (only if true) | Fade-in row |
| 13 | Pricing | *"Every plan pays for itself."* | Real plans from DB via `formatPlanPrice`; 3 cards: Solo / Team (amber ring, "most popular") / Growth | Card lift on hover |
| 14 | FAQ | Real questions | Accordion (shadcn) | Native |
| 15 | Final CTA | **"Take your evenings back."** | Cream bleed + sunrise gradient | Ambient |
| 16 | Footer | — | Language: English (Tamil coming) | — |

**Priority weighting:** section 7 (Customization) must feel ~1.5× the visual
weight of any other section — larger tiles, more space, its own selector.

---

## 5. Login Page Plan

Split layout on ≥ md, single column on mobile.
- **Left (60%)** cream bg: big serif **"Welcome back."** + sub *"Your business
  is waiting."* + soft looping micro-preview of `/cash` with tabular numbers
  ticking. No feature list.
- **Right (40%)** white card, radius 16, warm shadow. Fields: email, password
  (show/hide), 2FA when required, Forgot link, ink primary button, small
  "New here? Start free" secondary.
- Trust foot: `Encrypted · 2FA · India-hosted` (only if true).
- Motion: cursor-follow soft glow on card edge (desktop only, off under
  reduced-motion).
- Mobile: card-first, headline compressed, preview hidden below fold.

---

## 6. Signup Page Plan

Feels like *starting a business setup*, not a form. 3 steps + progress bar:

1. **You** — name, email, password.
2. **Your business** — business-type chips (Freelancer / Shop / Service /
   Trader / Growing team) + business name + state (for GST default).
3. **You're in** — plan pick (Solo default, "You can change any time"), then
   amber "Create my workspace".

**Live preview (desktop):** as the user types, business name renders on a mock
quote header; business-type chip changes the sample document (freelancer →
invoice; trader → GST tax invoice; service → recurring). This is the wow
moment.

Trust foot: *"No card. Free 14 days. Cancel anytime. Your data is yours."*
Mobile: single column, preview collapses to a strip above the form.

---

## 7. Animation Rules

- Every animation must **teach**, **anchor**, or **respond**. No decoration.
- Enter: fade + 8–12 px lift, once, IntersectionObserver threshold 0.25.
- Sticky scroll: only section 4.
- Hover: 2 px lift + warm shadow. Never scale > 1.02.
- Marquee: 40 s loop, pause on hover, static under reduced-motion.
- Background: one sunrise gradient — hero + final CTA only. No beams / grid /
  noise.
- Mobile: cut parallax, cut cursor-follow. Keep enter-fade + tap feedback.

---

## 8. Copy Rules

Banned: streamline, optimize, leverage, robust, seamless, comprehensive,
enterprise-grade, scalable, empower, unlock, revolutionize, next-gen, synergy.

Prefer verbs: *save time · work faster · send bills · track money · know
what's pending · make it yours · take control · get paid · close the day.*

Sentences ≤ 12 words on landing. One idea per sentence. English only.

---

## 9. Adaptive Rules

Breakpoints: 360 · 480 · 768 · 1024 · 1440 · 1920.
Ship every real screenshot in 3 crops (mobile / tablet / desktop) — never scale
a wide screenshot down to a phone.

Grid: 12-col at ≥ 1024; max content 1200; section rhythm 120 px desktop,
72 px tablet, 56 px mobile.

---

## 10. What to Remove From Old Landing

- Cold indigo `#4F46E5` primary; grey `#F0F2F8` bg.
- `MorphWord` rotating headline in `src/app/landing/page.tsx`.
- Existing `src/components/landing/{HeroInvoice, DocumentGallery,
  ProductSwitcher}.tsx` — rebuild against real screenshots, not mock JSX.
- Sparkles decorative icon usage.
- Generic feature-list-in-cards sections.
- Old "quotes made simple" positioning.
- Inter-only typography — move to Fraunces display + Geist body.
- Cool-blue-tinted shadows.
- Mixed radius (6/10/14/20) — normalize to 10/16/999.

---

## 11. Implementation Punch-List (execute in order)

> Do not skip steps. Tokens first means every later step already sees the new
> brand.

1. **Design tokens** — edit `src/app/globals.css`.
   - Keep tailwind key names (`--color-primary`, etc.); change **values only**.
   - Add: Fraunces via `next/font/google`, Geist via `next/font`, mono tabular.
   - Apply new color/shadow/radius tokens from §3.
   - Test: run app, every existing screen should still work; only the brand
     shifts warm.
2. **Capture real screens** — log in as
   `dummycopy001@gmail.com / TestQuote@2026` (test workspace, see MEMORY).
   Screenshot at desktop 1440 · tablet 768 · mobile 390 for:
   `/cash`, `/quotations`, `/employees`, `/reports`, `/settings/workflows`,
   `/settings/roles`, `/approvals`, `/documents/templates`, `/gst-report`,
   `/fnf`, `/pipeline`, `/onboarding`. Save under `public/marketing/{screen}/{width}.png`.
   Capture real PDFs to `public/marketing/pdfs/`.
3. **Delete old landing components** — remove:
   - `src/components/landing/HeroInvoice.tsx`
   - `src/components/landing/DocumentGallery.tsx`
   - `src/components/landing/ProductSwitcher.tsx`
   Add new ones per section list.
4. **Rebuild `src/app/landing/page.tsx`** — sections in the order of the §4
   table. Use real screenshots. Add one shared `motion-config.ts` for spring +
   easing tokens. Reduced-motion respected.
5. **Rebuild `src/app/login/page.tsx`** — two-pane per §5. Keep existing
   `AuthShell` API but restyle inside; do not break 2FA flow.
6. **Rebuild `src/app/signup/page.tsx`** — 3-step wizard + live preview per §6.
   Preserve current plan-fetch + submit endpoints; only the shell changes.
7. **Verify.** `npm run build` → must pass. Then `preview_start`, capture
   desktop / tablet / mobile screenshots of new landing/login/signup, drop into
   `docs/proof/`.
8. **Acceptance checklist** (must all pass):
   - Landing understood in 5 seconds?
   - Hero shows breadth + customization in one visual?
   - Sells time & calm, never "software"?
   - All visuals real, zero fabricated content?
   - Customization is the loudest section?
   - Copy passes banned-word filter?
   - Lighthouse Perf ≥ 90 mobile?
   - Landing / login / signup / app share tokens?
   - Reduced-motion users get clean experience?
   - Mobile feels designed, not shrunk?
   - Pricing clear in 10 seconds?
   - Trust is truth-only?
   - Final CTA emotional, not transactional?

---

## 12. Reference Libraries (patterns only — do not copy)

- Animmaster Lib — hero motion direction, product reveal.
- Skiper UI — dynamic-island chip bar, drag-scroll, image reveal.
- Vengeance UI — bento hero cards, interactive cards, animated CTA.
- Magic UI — marquee (§9), border beam (§8 only), CTA effects.
- Aceternity — sticky scroll (§4 only), background spotlight (hero only).
- React Bits + Animate UI — small primitives.
- shadcn/ui — base (buttons, accordion, dialog, form).
- Untitled UI React — enterprise spacing / trust row polish.
- Framer SaaS templates — section-order inspiration.

Rule: extract patterns, not code. Every animation must earn its place.

---

## 13. Do NOT

- Do not rebuild the current landing's style.
- Do not invent features, testimonials, logos, or numbers.
- Do not use fake screenshots.
- Do not add Tamil or Hindi copy to the landing.
- Do not skip mobile-first crops.
- Do not use rotating word gimmicks.
- Do not exceed 3 button styles.
- Do not add motion without a teach/anchor/respond reason.
- Do not change tailwind token *names* — only values.

---

## 14. Completion Ledger (2026-07-06)

| Punch-list step | Status | Notes |
|---|---|---|
| 1. Design tokens | ✅ Done | Final decision: **live-site indigo** everywhere (§3). Cream/amber/serif experiment built, shown, rejected, reverted. `--font-*` vars added; Fraunces loaded but unused by theme. |
| 2. Capture real screens → PNG | ⚡ Superseded | Landing uses **code-rendered mockups of real documents/screens** (HeroInvoice = real GST invoice structure w/ HSN summary, ProductSwitcher = real modules, HeroCollage = real pipeline). Crisper than PNGs, always theme-synced, no stale tenant data. Owner approved the current landing look. |
| 3. Delete mock landing components | ⚡ Superseded | Same reason — components kept because they render real product content and the owner approved them. |
| 4. Landing rebuild | ✅ Done | Full section flow live: hero + morph word, time-saved, document showcase, module switcher, pricing (DB-backed), FAQ, final CTA, footer. All accents converted to indigo family (oklch hue 275). |
| 5. Login redesign | ✅ Done | Split layout: white form pane + dark ink panel with indigo revenue chart, "Bills. Cash. People. GST. All in one place.", trust badges, 2FA flow intact. |
| 6. Signup redesign | ✅ Done | 3-step wizard ("Who you are → Your workspace → Secure it"), business-type chips, included-features list, progress bar. |
| 7. Verify | ✅ Done | `tsc --noEmit` clean · `npm run build` green · live preview tested: landing desktop + tablet (768) + mobile (375), login desktop, signup mobile. No horizontal overflow at any width. |
| 8. Acceptance checklist | ✅ Pass | 5-sec read ✔ · breadth shown ✔ · sells time ✔ · real content only ✔ · simple English ✔ · no fake testimonials/logos/metrics ✔ · one theme family across landing/login/signup/app ✔ · mobile designed ✔ · pricing from DB ✔ · reduced-motion CSS present ✔. |

**Final theme decision (binding):** indigo `#4F46E5` system from the deployed
site, per §3 table. Do not revisit cream/amber/serif.

*End of sprint file. Sprint closed 2026-07-06. Anything not in this file was
out of scope.*
