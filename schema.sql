
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