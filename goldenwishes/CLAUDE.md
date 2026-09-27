# Golden Wishes — shared project context (read this first)

## What we're building
Golden Wishes is a Make-A-Wish-style donation platform working with verified partner associations in Morocco.
Each **wish** (called "offer" in the front-end code) is a concrete need (an item or a service) with an anonymized story;
donors fund it fully or partially.

- Hackathon: GoMyCode × NVIDIA, track "AI World Impact".
- Code: `goldenwishes/` folder of https://github.com/khawlaaas/GoldenWishes-by-Fakers (public repo; the database files are at its root).
- Demo flow that must always work: **browse → filter → chat recommendation → co-finance**, in English, French and Arabic.
- All AI goes through NVIDIA hosted models (build.nvidia.com). This is a judging criterion.

## The person driving you
Reda doesn't write code himself. Always:
- Explain in 2-3 plain sentences what you are about to do before doing it.
- Give the exact commands to run and exactly what to click in the browser to verify.
- Prefer simple, robust solutions. Don't refactor anything you weren't asked to touch.

## Stack — keep it
- A single `index.html`: React 18 + ReactDOM via CDN (UMD), Tailwind via CDN, Motion One via CDN, no build step,
  components written with `React.createElement` (aliased `e`), not JSX.
- Do NOT introduce a new framework or a build step. New code = plain JS files loaded with `<script src>`,
  plus Netlify Functions for anything that needs a secret (NVIDIA key, database).
- Postgres (Neon) through Netlify Functions only, with the `pg` package; Netlify Blobs for late embeddings.

## File layout (one file per feature, keep index.html small)
```
index.html                     shell: CDN scripts, design-system CSS, script tags in order, App + hash router
netlify.toml                   functions dir + redirect /api/* -> /.netlify/functions/:splat
js/i18n/en.js fr.js ar.js      all UI text (same keys) · i18n.js: t(), tx(), Intl money/dates, language switch
js/core/ui.js                  C tokens, Icon, WishMark, TreeHero, fields, buttons, Header/Footer, PageShell, labels
js/core/motion.js              reveals, count-ups, page transition (Motion One, reduced-motion aware)
js/core/router.js, api.js      hash router · calls to /api/* ({ ok, data } or { ok: false, error, code })
js/data/schema.js              categories + validateOffer()
js/data/mapping.js             DB row -> front-end offer / news / contribution (used by browser and Node)
js/data/store.js               data layer: DATA_SOURCE 'api' (DB) or 'local' (snapshot + localStorage)
js/data/seed-*.js              offline snapshot of the DB (generated), offer-embeddings.json (generated)
js/features/home|browse|cofinance|chat|news|intake/   one folder per feature
netlify/functions/*.js         one endpoint per file (one model call max per function)
netlify/lib/                   db.js (pool), wishes.js (public SQL), auth.js (review code), nvidia.js, translate.js, i18n.js
scripts/                       export-local-seed, embed-offers, translate-content, check-i18n
../migrations/                 at the repo root: 001-002 (applied), 003 cleanup (owner account); schema changes = new migrations
```
Views use hash routes: `#/`, `#/offer/:id`, `#/needs`, `#/news`, `#/make-a-wish`, `#/review`.
The wishes list reads filters from the URL (e.g. `#/?country=MA&region=Souss-Massa&category=education`) so News,
the needs map and the chatbot can link to it.

## Data
**Database (source of truth):** Postgres, schema in the database repo (schema.sql + migrations/). Only Netlify Functions
talk to it (`netlify/lib/db.js`, user gw_app, `DATABASE_URL`). Public SQL lives in `netlify/lib/wishes.js` and never selects
`raw_submission`. Never re-apply migrations or seed; gw_app cannot change the schema: write a new `migrations/00X_*.sql` for the team.
- Donations: INSERT into `donations` only (is_demo = true); the trigger updates amount_raised / status / donor totals and refuses
  amounts above what remains or closed wishes. "Reset demo data" = `reset_demo_donations()`. Never update amounts in code.
- AI intake: status pending_review, submission_source 'ai_intake', organization "Independent submissions (to be assigned)".
  Review: approve (status open + reviewed_at) → embed (Blobs) → translate fr, ar; reject (status rejected). Nothing is deleted.
- Mapping (`js/data/mapping.js`): urgency low/medium/high/critical → 1/3/4/5, estimated_cost → total_price,
  story_context → backstory, nickname + age → beneficiary_alias, open + partially_funded → open, funded + delivered → funded.
- Offer (front-end): `{ id, title, description, backstory, beneficiary_alias, category (10 DB keys), tags, country, country_code,
  region, city, urgency 1-5, total_price, currency, amount_raised, status, db_status, verified_by, trust, relay_point, rag_text, created_at }`.
- `GW.store`: sync reads `getOffers()`, `getOffer(id)`, `getNews()`, `remaining(o)`, `getContributions(id)`; Promise writes
  `contribute(id, amount, donor)`, `addPendingOffer(offer, meta)`, `loadReviewQueue()`, `review(id, action)`, `reset()`, `submitForm()`.
- After DB content changes: `node scripts/export-local-seed.js` (offline snapshot), `node scripts/embed-offers.js` (embeddings),
  `node scripts/translate-content.js` (missing translations; resumable).
- Mock news items are labeled "Sample data" in the UI.

## Languages (English, French, Arabic)
- All UI text lives in `js/i18n/en.js`, `fr.js`, `ar.js` (same keys). Use `t('section.key', vars)` / `tx()` in views, never a literal.
  Run `node scripts/check-i18n.js` after adding text. Amounts/dates: `formatMAD`, `formatAmount`, `GW.i18n.fmtDate`.
- Arabic = `<html dir="rtl">`: logical Tailwind classes only (`ms-/me-/ps-/pe-/start-/end-`, `border-s`), never left/right;
  directional icons flip via `FLIP_RTL`. Arabic fonts: Noto Naskh Arabic (display) + IBM Plex Sans Arabic (text); no letter-spacing.
- DB content is translated ONCE into the `translations` columns (script + `/api/translate-wish` at approval). Never on page load.
- AI answers (chat explanations, trust reasons) follow the site language; Darija is still understood as input.

## Design system (editorial, same palette)
- Tokens `C`: paper, paperDeep, ink, inkSoft, purple, purpleDeep, gold, pink, orchid, sage, line. For TEXT use the safe shades
  `C.goldText`, `C.pinkText`, `C.sageText` (gold/pink/sage are for fills and marks only). Input borders `C.field`.
- Type: `.t-display`, `.t-h2`, `.t-h3` (Fraunces), `.t-eyebrow` (Plex Mono labels), `.t-story` (reading text), `.num` (tabular).
  Spacing scale 4 8 12 16 24 32 48 72 112 px; `.wrap` = 12-col container. Sections start with `SectionHead` (numbered eyebrow).
- No emoji in buttons or headings, no gradients or glows, no uniform card grids, no centered sections: rules and asymmetric columns.
- Accessibility: text contrast ≥ 4.5:1 on paper, tap targets ≥ 44px (buttons/fields already are), visible `:focus-visible` ring,
  labels on every field. Motion via `GW.motion` / `GW.CountUp` / `data-reveal`; everything must work with prefers-reduced-motion.
- The wish mark (`WishMark`) is on every wish row; `seal` plays the fully funded moment once.

## AI rules
- Endpoint: NVIDIA OpenAI-compatible API, `https://integrate.api.nvidia.com/v1` (chat completions + embeddings).
- Key in env var `NVIDIA_API_KEY`, database in `DATABASE_URL`: local `.env` (read by `netlify dev`) and Netlify environment
  variables in prod. NEVER in index.html, any js/ file, or a commit. `.env` is in `.gitignore`; `.env.example` has placeholders.
- Model names in env vars (`NVIDIA_CHAT_MODEL`, `NVIDIA_EMBED_MODEL`, `NVIDIA_CHAT_MODEL_FALLBACK` used once on 503).
- Netlify Functions have a short execution time limit: ONE model call per function; chain endpoints from the browser.
- Ask for JSON output, validate it, retry once, otherwise return a clean error (with a `code`) the UI can translate.
- The model NEVER does money math. Budgets, allocations and totals are computed in JS and validated server-side against the DB.
- `DEMO_FALLBACK=true` makes every AI endpoint return canned responses (in case the API or Wi-Fi fails on stage).
- Free tier is rate-limited (~40 requests/min): no calls in loops, precompute embeddings and translations with the scripts.

## Privacy
Public stories are anonymized. `raw_submission` is private (reviewers only, never returned by an endpoint).
Never generate or display photos of children's faces: use item photos or illustrations.

## Working method
- Plan first, wait for approval, then implement step by step and test as you go.
- One git commit per finished feature or page, so we can roll back if something breaks.
- Test in the 3 languages after every change to a view (headless browser flow + axe audit when possible).
- Only stop and ask Reda when you truly need him: a missing key, a choice only he can make, or something to test in the browser.

## Progress
- [x] F1-F7 features (schema, filters + needs map, urgency, co-financing, news, AI chat, AI intake + trust check)
- [x] Database connection (Postgres via Netlify Functions, gw_app, trigger-based donations, review queue in the DB)
- [x] JLM / ENSAM references removed
- [x] English / French / Arabic with full RTL, DB content translated
- [x] Editorial redesign (7 pages), accessibility audit clean in 3 languages, desktop and mobile
- [ ] Moved into goldenwishes/ of GoldenWishes-by-Fakers (pending Reda's OK on the push)
