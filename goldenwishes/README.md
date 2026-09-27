# Golden Wishes

**Live:** https://goldenwishes-fakers.netlify.app · GoMyCode × NVIDIA hackathon, track "AI World Impact" · Team: The Fakers

Golden Wishes connects donors with **small, concrete, verified needs** of children and families in Morocco: a blanket, a school bag, a month of medication. Each need is confirmed in person by a partner association and published with an anonymized story. Anyone can fund it fully or in part, in English, French or Arabic.

## The problem

Many people in Morocco want to help but don't know **who needs what, where, and whether it's genuine**. Donating to a general fund feels distant, and helping someone directly exposes both sides to fraud and privacy risks. Associations, for their part, spend a lot of time turning messy requests (voice notes, Darija messages) into something a donor can act on.

## What Golden Wishes does

| For | What they get |
|---|---|
| **Donors** | A list of verified needs with a price and a progress bar. They can give any amount or complete a wish. An AI assistant takes a sentence like *"3ndi 500 dh, bghit n3awen drari f l9raya"* ("I have 500 dirhams, I want to help kids with school") and proposes how to split it across the best-matching wishes. |
| **Associations** | They paste a need in any language. The AI turns it into a clean, anonymized listing and runs a trust check before a human reviews it. |
| **Everyone** | A needs map (what is still missing, per region and category) and a news tab that links crises to the wishes of that region. |

## How NVIDIA AI is used

Every AI feature runs on **NVIDIA hosted models** (build.nvidia.com), called from server-side functions: the key never reaches the browser.

| Step | NVIDIA model | What it does |
|---|---|---|
| Understand the donor | `nemotron-3-super-120b-a12b` | Reads a message in Darija (Latin letters), French, English or Arabic and extracts the budget, the causes, the region and an English search query |
| Find the right wishes | `nemotron-3-embed-1b` | Semantic search: the query's embedding is compared with the embedding of each open wish |
| Explain the choice | `nemotron-3-super-120b-a12b` | One sentence per chosen wish, in the site's language, with no numbers |
| Structure a submission | `nemotron-3-super-120b-a12b` | Turns messy text into a listing (title, story, category, region, urgency). Names, phone numbers and emails are removed again in code afterwards |
| Trust check | `nemotron-3-super-120b-a12b` + rules | Deterministic rules (price far above similar wishes, phone number, "pay me directly", luxury item...) plus a second opinion from the model. It only flags: a human decides |
| Three languages | `nemotron-3-super-120b-a12b` | Every wish and news item is translated into French and Arabic once, stored in the database. New wishes are translated at approval |

**Design choices that make the AI safe to use with money:**
- **The model never does money math.** The split of the budget is computed in code, then checked again on the server against the live amounts in the database.
- **The database has the last word.** A donation larger than what remains, or on a closed wish, is refused by the database itself.
- **It keeps working without AI.** If NVIDIA is slow or down, the site falls back to a keyword parser, keyword matching and rules only. A demo mode returns prepared answers when there is no network at all.
- **One model call per server function**, all JSON answers validated and retried once, and a lighter backup model (`nemotron-3.5-lightning`) if the main one is overloaded.

## Trust and privacy

- **Verified before published.** A wish is visible only after a partner organization has confirmed it. AI submissions wait in a review queue (protected by a code) and are never published automatically.
- **Anonymized stories.** Children appear with a nickname and age only: no surname, address or school name. The original text of a submission stays private and is never sent to the public site.
- **No direct payments to individuals.** Money is always attached to a wish and its partner organization. Asking to be paid directly is one of the trust-check red flags.
- **No photos of children's faces**, ever.

## Try it (3 minutes)

1. **Open** https://goldenwishes-fakers.netlify.app. The counters show what is still needed right now. Click **ع** at the top: the whole site switches to Arabic, right to left.
2. **Ask the assistant** (bottom corner): click the Darija example. You get up to 3 wishes, how the 500 MAD is split, a reason for each, and the trace of which NVIDIA model did what. Click **Fund this plan**: the progress bars move.
3. **Complete a wish.** Open a wish that is almost funded and click **All … MAD** then **Fund**: its mark closes into a gold seal.
4. **News.** Open the storm in Ouarzazate and click **Help this region**: you land on the wishes of that region.
5. **Submit a need.** Click **Use an example** (a Darija message with a child's full name and a phone number), then **Structure with AI**: the name and number are gone. Then **Run trust check**.
6. **Review queue** (ask the team for the review code). Run the trust check on "A brand-new premium school backpack": it is flagged, because its 5,000 MAD price is far above similar wishes.

Donations made on the site are demo donations: the team resets them with one click on the Review page.

## What is real, what is sample data

- **Real:** the application, the PostgreSQL database behind it, the NVIDIA models, the review workflow, the three languages.
- **Sample data:** the 42 wishes, the 8 partner organizations and their stories are fictional but realistic (hand-written, anonymized). The 7 news items are fictional and labeled "Sample data" on the site. No real money moves.

## Accessibility and languages

- English, French and Arabic, with the Arabic version fully right to left and Moroccan number and date formats.
- Checked with an automated accessibility audit (axe) on every page, in the 3 languages, on desktop and phone:
  - text contrast of at least 4.5:1;
  - touch targets of at least 44px;
  - visible keyboard focus;
  - animations disabled for people who ask their device to reduce motion.

## How it's built

- **Front-end:** a static site (React 18, Tailwind and Motion One from CDNs, no build step). The layout is editorial and the palette comes from the original Golden Wishes brand.
- **Back-end:** Netlify Functions. They are the only code that talks to the database and to NVIDIA.
- **Database:** PostgreSQL (Neon). The schema, migrations and seed data are at the root of this repository ([data model](../README.md)). The site connects with a limited database user that cannot change the schema or delete wishes. A database trigger keeps every amount consistent.

```
index.html · js/ (UI, 3 language files, data layer) · netlify/functions/ (one endpoint per file) · scripts/ (embeddings, translations)
```

<details>
<summary><b>Run it locally</b></summary>

Requires Node 18+ and the Netlify CLI (`npm install -g netlify-cli`).

```bash
cd goldenwishes
cp .env.example .env     # DATABASE_URL (gw_app user, pooled host), NVIDIA_API_KEY, REVIEW_CODE
npm install
netlify dev              # http://localhost:8888
```

Optional environment variables: `NVIDIA_CHAT_MODEL`, `NVIDIA_CHAT_MODEL_FALLBACK`, `NVIDIA_EMBED_MODEL`, and `DEMO_FALLBACK=true` (canned AI answers, no network needed).

Scripts, run from `goldenwishes/`:

| Script | What it does |
|---|---|
| `node scripts/embed-offers.js` | Precompute the wish embeddings |
| `node scripts/translate-content.js` | Translate the wishes and news that are missing a translation |
| `node scripts/export-local-seed.js` | Refresh the offline snapshot |
| `node scripts/check-i18n.js` | Check the three language files |

To deploy on Netlify: base directory `goldenwishes`, no build command, and the environment variables above.

</details>
