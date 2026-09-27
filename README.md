# Golden Wishes

Golden Wishes is a donation platform in the spirit of Make-A-Wish. Each **wish** is a concrete need (a school bag, a winter coat, a month of groceries) with an anonymized story. Donors can fund a wish fully or in part, and an AI assistant powered by NVIDIA models helps them find the wishes that match their budget and priorities.

Built for the GoMyCode × NVIDIA hackathon, track "AI World Impact".

## Repository structure

```
goldenwishes/                         Web app (front-end + Netlify Functions + AI)
schema.sql                            Base database schema (PostgreSQL)
migrations/
  001_golden_wishes_features.sql      Adds everything the web app needs (see below)
  002_app_role.sql                    Limited database user for the website
generate_seed_data.py                 Generates the demo data
seed_data.sql / seed_data.json        Generated demo data
golden_wishes_full_dump.sql           Full dump of the demo database
```

**Web app:** see [goldenwishes/README.md](goldenwishes/README.md) (stack, environment variables, how to run, Netlify deploy, demo checklist).

## Database setup

Requirements: PostgreSQL 14+ hosted online (Neon or Supabase, free tier), with the `uuid-ossp`, `pg_trgm` and optionally `vector` extensions. `psql` installed locally.

Run the files **in this order**:

```bash
psql "$OWNER_DATABASE_URL" -f schema.sql
psql "$OWNER_DATABASE_URL" -f migrations/001_golden_wishes_features.sql
psql "$OWNER_DATABASE_URL" -f seed_data.sql
psql "$OWNER_DATABASE_URL" -f migrations/002_app_role.sql   # after setting the password locally
```

- `seed_data.sql` disables the donation trigger during the import and re-enables it at the end, so amounts are never counted twice.
- Before running `002_app_role.sql`, replace `CHANGE_ME_STRONG_PASSWORD` in your local copy with a long random password. **Never commit it.**

### Regenerating the demo data

```bash
pip install faker
python3 generate_seed_data.py
```

The generator is deterministic: the same command always produces the same data.

### Regenerating the full dump

```bash
pg_dump "$OWNER_DATABASE_URL" --no-owner --no-privileges > golden_wishes_full_dump.sql
```

## Connecting the web app

The web app reads the connection string from the environment variable `DATABASE_URL`:

```
postgresql://gw_app:<password>@<host>/<database>?sslmode=require
```

- Use the **gw_app** user, never the owner account.
- Use the **pooled** host: on Neon the host containing `-pooler`, on Supabase the transaction pooler (port 6543). Netlify Functions open many short-lived connections.
- Put it in `goldenwishes/.env` for local development, and in Netlify under *Site settings → Environment variables* for production.
- **This repository is public: no connection string, password or API key must ever be committed.**

## Data model

| Table | Content |
|---|---|
| `organizations` | Partner associations, orphanages, hospitals and community centers that verify the needs and receive the items |
| `beneficiaries` | The children, always anonymized: nickname and age only, no surname, no address |
| `wishes` | The needs shown to donors: story, cost, amount raised, urgency, location, review status, trust score, translations |
| `donors` | Donors (plus one shared "Anonymous donor" row) |
| `donations` | Each contribution, full or partial |
| `news_items` | Crisis news by region, linked to the needs of that region (mock data in the demo) |
| `volunteer_applications`, `partner_requests` | Forms submitted from the website |

`active_wishes_view` returns the wishes open to donations (`open` and `partially_funded`) with their organization. Private fields such as `raw_submission` are not exposed.

### Built-in rules

- **Donations update wishes automatically.** A trigger on `donations` updates `amount_raised`, the wish status and the donor's total in the same transaction. It refuses a donation larger than the remaining amount or on a wish that is not open. The app only inserts donations and never updates amounts itself.
- **Demo reset.** `SELECT reset_demo_donations();` removes only donations flagged `is_demo` and gives the amounts back. Seed data is never touched.
- **Review before publication.** Wishes submitted through the AI intake are stored with status `pending_review` and stay hidden until a partner approves them. The trust score only flags; a human always decides.
- **RAG text.** A trigger rebuilds `rag_text` (title, description, story, category, urgency, cost, location, tags) on every change. The AI assistant uses it for semantic matching.

## Schema changes (migration 001)

All changes are additive: no table or column was dropped or renamed.

| Change | Why |
|---|---|
| `wishes.country`, `wishes.country_code`, same on `organizations` | Country and region filters |
| New categories `shelter`, `food` | Needs linked to crises (storms, floods) |
| New statuses `pending_review`, `rejected` | Review queue for AI-submitted wishes |
| `wishes.trust_score`, `trust_reasons`, `submission_source`, `raw_submission`, `reviewed_at`, `review_note` | AI intake and trust check |
| Organization "Independent submissions (to be assigned)" | AI-submitted wishes need an organization until a partner takes them over |
| `wishes.translations` (JSONB) | Arabic and French versions of each wish |
| `set_wish_rag_text()` now includes story, tags and country | Better matching for the AI assistant |
| `donations.donor_display_name`, `donations.is_demo`, positive amount check, "Anonymous donor" row | Co-financing and demo reset |
| Trigger `trg_apply_donation`, function `reset_demo_donations()` | Consistent amounts enforced by the database |
| Tables `news_items`, `volunteer_applications`, `partner_requests` | News tab and website forms |
| `active_wishes_view`: new columns appended | Exposes country, story, translations, trust score |
| Relay points no longer reference any school | Neutral wording for partner locations |

Migration 002 adds the `gw_app` role with limited privileges.

## Demo data

- 8 fictional partner organizations across 8 Moroccan regions.
- 40 unique wishes with hand-written, anonymized stories, covering every category, urgency level and funding stage (open, partially funded, almost funded, funded, delivered). Amounts always match the recorded donations.
- 2 suspicious submissions in `pending_review` to demonstrate the trust check: an overpriced school bag, and a story copied from another wish.
- 7 mock crisis news items, including a storm in Ouarzazate (Drâa-Tafilalet) linked to shelter and food needs.
- All names, organizations, phone numbers and emails are fictional (`@example.org`).

## Team

The Fakers: GoMyCode × NVIDIA hackathon, 2026.
