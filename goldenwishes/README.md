# Golden Wishes: the web app

A Make-A-Wish-style donation platform working with **verified partner associations** in Morocco. Each wish is a concrete need (an item or a service) with an anonymized story. Donors fund it fully or in part. An assistant powered by **NVIDIA Nemotron** helps them decide where their money helps most. English, French and Arabic (right-to-left).

Built for the GoMyCode × NVIDIA hackathon, track "AI World Impact". The database files (schema, migrations, seed) are at the root of this repository. This folder is the app. `../migrations/003_cleanup_test_data.sql` removes a test donor left by the app's automated tests (run once with the owner account).

## What it does

| Feature | Where | AI |
|---|---|---|
| Browse wishes, filter by region / category / urgency (filters live in the URL) | `#/` | |
| Co-financing: give any amount, never more than what's left (enforced by the database) | `#/offer/:id` | |
| Needs map: MAD still needed per region and category | `#/needs` | |
| News: sample crises that link to the wishes of that region | `#/news` | |
| Chat assistant: "3ndi 500 dh, bghit n3awen drari f l9raya" returns a split across wishes | chat button | Nemotron + embeddings |
| Submit a need: messy text (any language) becomes a clean, anonymized listing | `#/make-a-wish` | Nemotron |
| Trust check + review queue: suspicious submissions are flagged, a human decides | `#/review` | rules + Nemotron |
| Three languages, with the database content translated once | EN · FR · ع in the header | Nemotron (offline script) |

## Stack

- `index.html` + plain JS files: React 18, Tailwind and Motion One from CDNs, **no build step** (components use `React.createElement`).
- Netlify Functions (`netlify/functions/`, one endpoint per file) are the only code that talks to Postgres and NVIDIA. No key ever reaches the browser.
- PostgreSQL (Neon) with the limited `gw_app` user, through the `pg` package (one small pooled connection, SSL).
- NVIDIA hosted models through the OpenAI-compatible API (`https://integrate.api.nvidia.com/v1`).
- Netlify Blobs store the embeddings of wishes approved after the static cache was built.

```
index.html              shell, design-system CSS, script tags, hash router
js/i18n/                en.js, fr.js, ar.js (all UI text) + i18n.js
js/core/                ui.js (tokens, components), motion.js, router.js, api.js
js/data/                schema.js, mapping.js (DB row -> offer), store.js (the only data access point), offline snapshot
js/features/            home, browse, cofinance, chat, news, intake
netlify/functions/      wishes, wish, donate, forms, submit-wish, review-queue, review, reset-demo,
                        chat-parse, embed, chat-explain, intake, trust-check, embed-wish, embeddings-extra, translate-wish, health, db-check
netlify/lib/            db.js, wishes.js (public SQL), auth.js, nvidia.js, translate.js, i18n.js, privacy.js, canned.js
scripts/                export-local-seed.js, embed-offers.js, translate-content.js, check-i18n.js
```

## Environment variables

| Name | Required | What |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://gw_app:<password>@<pooled-host>/<db>?sslmode=require` (gw_app user, **pooled** host) |
| `NVIDIA_API_KEY` | yes | key from build.nvidia.com |
| `REVIEW_CODE` | yes on the live site | code reviewers type on `#/review` to approve, reject and reset demo data |
| `NVIDIA_CHAT_MODEL` | no | default `nvidia/nemotron-3-super-120b-a12b` |
| `NVIDIA_CHAT_MODEL_FALLBACK` | no | used once if the main model is overloaded (503), default `nvidia/nemotron-3.5-lightning-30b-a3b` |
| `NVIDIA_EMBED_MODEL` | no | default `nvidia/nemotron-3-embed-1b` |
| `DEMO_FALLBACK` | no | `true` = every AI endpoint returns canned answers (no network needed on stage) |

Locally they go in `goldenwishes/.env` (copy `.env.example`). On Netlify they go in *Site configuration → Environment variables*. **This repository is public: never commit `.env`, a key or a connection string.**

## Run it locally

Requires Node 18+ (22 recommended) and the Netlify CLI (`npm install -g netlify-cli`).

```bash
cd goldenwishes
cp .env.example .env          # fill in DATABASE_URL and NVIDIA_API_KEY
npm install                   # pg + @netlify/blobs
netlify dev                   # open http://localhost:8888
curl localhost:8888/api/health     # {"ok":true,"hasKey":true,...}
curl localhost:8888/api/db-check   # counts, and (locally only) a 1 MAD demo donation + reset to test the trigger
```

Without `REVIEW_CODE`, the review queue stays open under `netlify dev` only.

**Offline mode.** Set `var DATA_SOURCE = 'local'` in `js/data/store.js`: the app runs on the database snapshot in `js/data/seed-*.js`, and donations stay in the browser.

### Scripts (run from `goldenwishes/`, they read `.env`)

```bash
node scripts/export-local-seed.js    # refresh the offline snapshot from the database
node scripts/embed-offers.js         # embeddings of open wishes -> js/data/offer-embeddings.json (one NVIDIA call)
node scripts/translate-content.js    # translate wishes + news into French and Arabic (only what is missing; safe to re-run)
node scripts/check-i18n.js           # the three language files have the same keys, every key used exists
```

## How the data and the AI work

- **Donations** are inserted into `donations` only, flagged `is_demo`. The database trigger updates `amount_raised`, the status and the donor's total, and refuses a donation above what remains or on a closed wish. The app shows those refusals as clean messages. **Reset demo data** calls `reset_demo_donations()`.
- **Submissions** from the intake page are stored with status `pending_review`, `submission_source = 'ai_intake'`, and the organization "Independent submissions (to be assigned)". The original text (`raw_submission`) is private: no endpoint ever returns it. **Approve** sets the status to `open`, then embeds the wish for the chat and translates it into French and Arabic. **Reject** sets it to `rejected`. Nothing is deleted.
- **Chat.** Each Netlify Function makes at most one model call, and the browser chains them:
  1. `chat-parse` (Nemotron) turns the message into a budget, categories, a region and an English query.
  2. `embed` turns the query into a vector, compared with the wishes' `rag_text` embeddings.
  3. The budget is split in plain JS (the model never does money math) and checked again on the server against the database.
  4. `chat-explain` writes one sentence per wish, in the site language.
- **Fallbacks.** If NVIDIA is down, the chat uses a keyword parser and TF-IDF, the trust check uses the rules alone, and the intake form can be filled in by hand.

## Deploy on Netlify

1. *Site configuration → Build & deploy → Continuous deployment*: link the repository `khawlaaas/GoldenWishes-by-Fakers`, branch `main`.
2. **Base directory: `goldenwishes`**. Build command: empty. Publish directory: `goldenwishes` (Netlify shows it relative to the base: `.`). Functions directory: `netlify/functions` (already set in `netlify.toml`).
3. *Environment variables*: add `DATABASE_URL`, `NVIDIA_API_KEY`, `REVIEW_CODE` (and optionally the model names and `DEMO_FALLBACK`).
4. Deploy, then open `https://<site>/api/health` and `https://<site>/api/db-check` (read-only in production).

## Demo checklist (about 4 minutes, real database)

Before going on stage: open **Review**, type the review code, click **Reset demo data**. If the Wi-Fi is unreliable, set `DEMO_FALLBACK=true` and redeploy (or restart `netlify dev`).

1. **Home.** The ledger counts up (MAD still needed, open wishes, fulfilled, partners). Click **ع**: the whole site switches to Arabic, right to left. Then click **FR**, then **EN**.
2. **Wishes.** Click the **Shelter** chip, then **Urgent only**. The most urgent wish is featured with its story, and every row has a **Fund** button.
3. **News.** Open "Violent storm hits Ouarzazate" (labeled Sample data) and click **Help this region**. The list is filtered to Drâa-Tafilalet.
4. **Needs map.** Click the first region row to land on its wishes.
5. **Chat.** Click **Ask the wish assistant**, then the example "3ndi 500 dh, bghit n3awen drari f l9raya". You get a split across up to 3 education wishes, a reason for each (in the site language, even though the request was in Darija), and the trace "understood by NVIDIA Nemotron · matched with NVIDIA embeddings". Click **Fund this plan**: the bars move, and a wish that gets completed seals in gold.
6. **Fully funded moment.** Open a wish that is almost funded (for example "A box of building blocks") and click **All … MAD**, then **Fund**. The mark closes into a gold seal and a **Fully funded** stamp appears.
7. **Submit a need.** Click **Use an example**, then **Structure with AI**: the name and phone number disappear. Click **Run trust check** (low risk). *Send for review* creates a real, permanent row, so only do it on purpose.
8. **Review.** Run the trust check on "A brand-new premium school backpack". It is flagged because its price is far above a typical school wish. Approve or reject only on purpose: approved wishes stay in the database.
9. Finish with **Reset demo data**: every donation made during the demo is removed and the amounts go back.

## Privacy

Public stories are anonymized: nickname and age only, no surname, address or school name. Names, phone numbers and emails are removed from AI drafts in code, whatever the model returns. No photos of children's faces are ever generated or shown. The news items are sample data and are labeled that way.
