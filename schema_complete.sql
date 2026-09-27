
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";



CREATE TYPE org_type AS ENUM (
    'orphanage',
    'hospital',
    'ngo',
    'community_center',
    'legal_guardian'
);

CREATE TYPE wish_category AS ENUM (
    'education',
    'essentials',
    'creative',
    'family_care',
    'health',
    'clothing',
    'technology',
    'sport'
);

CREATE TYPE urgency_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE wish_status AS ENUM (
    'open',
    'partially_funded',
    'funded',
    'delivered',
    'expired'
);

CREATE TYPE beneficiary_situation AS ENUM (
    'orphan',
    'family_in_difficulty',
    'chronic_illness',
    'hospitalization',
    'temporary_placement'
);



CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(150) NOT NULL,
    org_type            org_type NOT NULL,
    contact_name        VARCHAR(100) NOT NULL,     
    contact_phone       VARCHAR(30) NOT NULL,
    contact_email       VARCHAR(150),
    city                VARCHAR(80) NOT NULL,
    region              VARCHAR(80) NOT NULL,
    relay_point         VARCHAR(150),               
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    verification_doc_url VARCHAR(255),              
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: beneficiaries
-- The child, ALWAYS anonymized (nickname only, no full name, no address)
-- ============================================================

CREATE TABLE beneficiaries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nickname            VARCHAR(50) NOT NULL,       -- e.g. "Amara", "Little Youssef" -- never a surname
    age                 SMALLINT CHECK (age BETWEEN 0 AND 18),
    gender              VARCHAR(10),
    situation           beneficiary_situation NOT NULL,
    health_note         TEXT,                       -- optional, e.g. "asthma", "post-op recovery"
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: wishes
-- The need/offer shown to donors (core of the product)
-- ============================================================

CREATE TABLE wishes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beneficiary_id      UUID REFERENCES beneficiaries(id) ON DELETE SET NULL,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    category            wish_category NOT NULL,
    title               VARCHAR(150) NOT NULL,       -- "A school bag, fully stocked"
    description         TEXT NOT NULL,               -- "Notebooks, pens, a compass set..."
    story_context       TEXT,                        -- optional longer narrative context

    estimated_cost      NUMERIC(10,2) NOT NULL,
    amount_raised       NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(5) NOT NULL DEFAULT 'MAD',

    urgency             urgency_level NOT NULL DEFAULT 'medium',
    status              wish_status NOT NULL DEFAULT 'open',

    relay_point         VARCHAR(150) NOT NULL,       -- e.g. "Relay point — ENSAM Casablanca"
    city                VARCHAR(80) NOT NULL,
    region              VARCHAR(80) NOT NULL,

    tags                TEXT[],                      -- e.g. {'school','supplies','back-to-school'}
    deadline            DATE,                         -- optional, for dated urgent needs

    -- RAG-optimized field: concatenates everything into natural text for embedding.
    -- Filled automatically by a trigger (see below) on every INSERT/UPDATE —
    -- not a GENERATED column, because Postgres does not allow enum casts
    -- inside generated expressions (they're considered non-"immutable").
    rag_text            TEXT,

    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- Trigger that builds rag_text automatically on every insert/update
CREATE OR REPLACE FUNCTION set_wish_rag_text() RETURNS TRIGGER AS $$
BEGIN
    NEW.rag_text := NEW.title || '. ' || NEW.description ||
        ' Category: ' || NEW.category::text ||
        '. Urgency: ' || NEW.urgency::text ||
        '. Estimated cost: ' || NEW.estimated_cost || ' ' || NEW.currency ||
        '. Location: ' || NEW.city || ', ' || NEW.region || '.';
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_wish_rag_text
BEFORE INSERT OR UPDATE ON wishes
FOR EACH ROW EXECUTE FUNCTION set_wish_rag_text();

-- Full-text / hybrid search indexes
CREATE INDEX idx_wishes_rag_text_trgm ON wishes USING gin (rag_text gin_trgm_ops);
CREATE INDEX idx_wishes_category ON wishes (category);
CREATE INDEX idx_wishes_urgency ON wishes (urgency);
CREATE INDEX idx_wishes_status ON wishes (status);
CREATE INDEX idx_wishes_tags ON wishes USING gin (tags);

-- ============================================================
-- TABLE: donors
-- ============================================================

CREATE TABLE donors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    phone               VARCHAR(30),
    preferred_categories wish_category[],            -- for AI matching
    total_donated       NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: donations
-- ============================================================

CREATE TABLE donations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id            UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    wish_id             UUID NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
    amount              NUMERIC(10,2) NOT NULL,
    donated_at          TIMESTAMP NOT NULL DEFAULT now(),
    message             TEXT                          -- optional short note from the donor
);

CREATE INDEX idx_donations_wish_id ON donations (wish_id);
CREATE INDEX idx_donations_donor_id ON donations (donor_id);

-- ============================================================
-- VIEW: useful for the RAG — open wishes with organization info
-- ============================================================

CREATE VIEW active_wishes_view AS
SELECT
    w.id,
    w.title,
    w.description,
    w.category,
    w.urgency,
    w.status,
    w.estimated_cost,
    w.amount_raised,
    (w.estimated_cost - w.amount_raised) AS amount_remaining,
    w.currency,
    w.city,
    w.region,
    w.relay_point,
    w.tags,
    w.rag_text,
    o.name AS organization_name,
    o.is_verified AS organization_verified
FROM wishes w
JOIN organizations o ON w.organization_id = o.id
WHERE w.status IN ('open', 'partially_funded');

-- ============================================================
-- Everything below this line is migrations/001_golden_wishes_features.sql
-- (kept identical to the repo file, appended here only so this single
-- script can be pasted once into Neon's SQL editor / psql).
-- ============================================================

-- Golden Wishes — migration 001
-- Adapts the team database (schema.sql + seed_data.sql) to the app features:
-- country filters, review queue + trust score, co-financing, news tab,
-- 3 languages, better RAG text, demo reset, forms without Google Sheets,
-- and removal of ENSAM relay points.
--
-- ADDITIVE ONLY: no table or column is dropped or renamed.
-- Safe to run twice. Run it after schema.sql and seed_data.sql:
--   psql "$DATABASE_URL" -f 001_golden_wishes_features.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. New enum values (outside the transaction on purpose)
-- ------------------------------------------------------------
ALTER TYPE wish_category ADD VALUE IF NOT EXISTS 'shelter';
ALTER TYPE wish_category ADD VALUE IF NOT EXISTS 'food';
ALTER TYPE wish_status   ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE wish_status   ADD VALUE IF NOT EXISTS 'rejected';

BEGIN;

-- ------------------------------------------------------------
-- 2. Country (feature: country/region filters, news tab)
-- ------------------------------------------------------------
ALTER TABLE wishes
  ADD COLUMN IF NOT EXISTS country      VARCHAR(80) NOT NULL DEFAULT 'Morocco',
  ADD COLUMN IF NOT EXISTS country_code CHAR(2)     NOT NULL DEFAULT 'MA';
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS country      VARCHAR(80) NOT NULL DEFAULT 'Morocco',
  ADD COLUMN IF NOT EXISTS country_code CHAR(2)     NOT NULL DEFAULT 'MA';
CREATE INDEX IF NOT EXISTS idx_wishes_country_region ON wishes (country_code, region);

-- ------------------------------------------------------------
-- 3. Review queue + trust score (feature: AI intake)
--    Submitted wishes get status 'pending_review' and are hidden
--    from active_wishes_view until approved.
-- ------------------------------------------------------------
ALTER TABLE wishes
  ADD COLUMN IF NOT EXISTS trust_score       SMALLINT CHECK (trust_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS trust_reasons     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submission_source VARCHAR(20) NOT NULL DEFAULT 'seed',  -- seed | ai_intake | manual
  ADD COLUMN IF NOT EXISTS raw_submission    TEXT,       -- PRIVATE: original text, admin only, never sent to the public API
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_note       TEXT;

-- Wishes require an organization: AI-intake submissions are attached to this
-- placeholder until an association takes them over.
INSERT INTO organizations (name, org_type, contact_name, contact_phone, city, region, is_verified)
SELECT 'Independent submissions (to be assigned)', 'community_center', 'Platform team', 'N/A',
       'Casablanca', 'Casablanca-Settat', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE name = 'Independent submissions (to be assigned)'
);

-- ------------------------------------------------------------
-- 4. Translations (feature: Arabic / French / English)
--    Shape: {"fr": {"title": "...", "description": "...", "story_context": "..."},
--            "ar": {...}}  — English stays in the original columns.
-- ------------------------------------------------------------
ALTER TABLE wishes ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------
-- 5. Richer rag_text for the chatbot: adds the story, tags and country.
--    COALESCE avoids a NULL rag_text when an optional field is empty.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_wish_rag_text() RETURNS TRIGGER AS $$
BEGIN
  NEW.rag_text := NEW.title || '. ' || NEW.description ||
                  COALESCE(' ' || NEW.story_context, '') ||
                  ' Category: ' || NEW.category::text ||
                  '. Urgency: ' || NEW.urgency::text ||
                  '. Estimated cost: ' || NEW.estimated_cost || ' ' || NEW.currency ||
                  '. Location: ' || NEW.city || ', ' || NEW.region || ', ' || NEW.country || '.' ||
                  COALESCE(' Tags: ' || array_to_string(NEW.tags, ', ') || '.', '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 6. Remove ENSAM relay points (the trigger recomputes rag_text for all rows)
-- ------------------------------------------------------------
UPDATE organizations
   SET relay_point = 'Relay point — partner association, ' || city
 WHERE relay_point ILIKE '%ENSAM%' OR relay_point ILIKE '%JLM%';

UPDATE wishes
   SET relay_point = 'Relay point — partner association, ' || city
 WHERE relay_point ILIKE '%ENSAM%' OR relay_point ILIKE '%JLM%';

UPDATE wishes SET title = title;  -- refresh rag_text with the new trigger

-- ------------------------------------------------------------
-- 7. Co-financing: anonymous donors, demo flag, integrity rules
-- ------------------------------------------------------------
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS donor_display_name VARCHAR(100),               -- name shown publicly, optional
  ADD COLUMN IF NOT EXISTS is_demo            BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE donations ADD CONSTRAINT donations_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- donations.donor_id is NOT NULL: donors who don't give their email use this row.
INSERT INTO donors (full_name, email)
VALUES ('Anonymous donor', 'anonymous@goldenwishes.local')
ON CONFLICT (email) DO NOTHING;

-- Every new donation updates the wish in the database itself:
-- refuses closed wishes and amounts above what remains, then updates
-- amount_raised, status and the donor's total, atomically.
-- IMPORTANT for the app code: insert the donation ONLY. Do not also update
-- wishes.amount_raised in the Netlify Function, or it will be counted twice.
CREATE OR REPLACE FUNCTION apply_donation() RETURNS TRIGGER AS $$
DECLARE
  w RECORD;
BEGIN
  SELECT estimated_cost, amount_raised, status INTO w
    FROM wishes WHERE id = NEW.wish_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish not found';
  END IF;
  IF w.status NOT IN ('open', 'partially_funded') THEN
    RAISE EXCEPTION 'This wish is not open for donations';
  END IF;
  IF NEW.amount > w.estimated_cost - w.amount_raised THEN
    RAISE EXCEPTION 'Donation exceeds the remaining amount (% MAD left)', w.estimated_cost - w.amount_raised;
  END IF;

  UPDATE wishes
     SET amount_raised = amount_raised + NEW.amount,
         status = CASE WHEN amount_raised + NEW.amount >= estimated_cost
                       THEN 'funded'::wish_status
                       ELSE 'partially_funded'::wish_status END
   WHERE id = NEW.wish_id;

  UPDATE donors SET total_donated = total_donated + NEW.amount WHERE id = NEW.donor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_donation ON donations;
CREATE TRIGGER trg_apply_donation
  BEFORE INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION apply_donation();

-- "Reset demo data": removes only donations flagged is_demo and gives the
-- money back to wishes and donors. The team's seed data is never touched.
CREATE OR REPLACE FUNCTION reset_demo_donations() RETURNS INTEGER AS $$
DECLARE
  removed INTEGER;
BEGIN
  UPDATE wishes w
     SET amount_raised = w.amount_raised - d.total,
         status = CASE WHEN w.amount_raised - d.total <= 0 THEN 'open'::wish_status
                       ELSE 'partially_funded'::wish_status END
    FROM (SELECT wish_id, SUM(amount) AS total FROM donations WHERE is_demo GROUP BY wish_id) d
   WHERE w.id = d.wish_id;

  UPDATE donors o
     SET total_donated = o.total_donated - d.total
    FROM (SELECT donor_id, SUM(amount) AS total FROM donations WHERE is_demo GROUP BY donor_id) d
   WHERE o.id = d.donor_id;

  DELETE FROM donations WHERE is_demo;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 8. News tab
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(200) NOT NULL,
  summary           TEXT         NOT NULL,
  country           VARCHAR(80)  NOT NULL DEFAULT 'Morocco',
  country_code      CHAR(2)      NOT NULL DEFAULT 'MA',
  region            VARCHAR(80)  NOT NULL,
  severity          SMALLINT     NOT NULL CHECK (severity BETWEEN 1 AND 5),
  needed_categories wish_category[] NOT NULL DEFAULT '{}',
  published_on      DATE         NOT NULL DEFAULT CURRENT_DATE,
  is_mock           BOOLEAN      NOT NULL DEFAULT TRUE,   -- shown as "Sample data" in the UI
  translations      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_region ON news_items (country_code, region);

-- ------------------------------------------------------------
-- 9. Volunteer / partner forms (no longer sent to the club's Google Sheet)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteer_applications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  phone      VARCHAR(30)  NOT NULL,
  school     VARCHAR(150),
  reason     TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_name VARCHAR(150) NOT NULL,
  contact_person    VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL,
  phone             VARCHAR(30)  NOT NULL,
  partnership_type  VARCHAR(50),
  message           TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 10. Public view: same columns as before + new ones appended at the end
--     (raw_submission is deliberately NOT exposed)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW active_wishes_view AS
SELECT
  w.id,
  w.title,
  w.description,
  w.category,
  w.urgency,
  w.status,
  w.estimated_cost,
  w.amount_raised,
  (w.estimated_cost - w.amount_raised) AS amount_remaining,
  w.currency,
  w.city,
  w.region,
  w.relay_point,
  w.tags,
  w.rag_text,
  o.name        AS organization_name,
  o.is_verified AS organization_verified,
  w.country,
  w.country_code,
  w.story_context,
  w.translations,
  w.trust_score,
  w.deadline,
  w.created_at,
  w.beneficiary_id
FROM wishes w
JOIN organizations o ON w.organization_id = o.id
WHERE w.status IN ('open', 'partially_funded');

COMMIT;

