/* Public SQL for wishes and news. Every column is listed explicitly:
 * raw_submission (private original text) is NEVER selected by these queries.
 * Rows come back DB-shaped (js/data/mapping.js turns them into front-end offers).
 */
const { query } = require('./db');

const TS = (col) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

// Open wishes come from active_wishes_view; funded/delivered ones from wishes (same columns).
const PUBLIC_WISHES = `
  SELECT v.id, v.title, v.description, v.story_context, v.category::text AS category, v.urgency::text AS urgency,
         v.status::text AS status, v.estimated_cost::float8 AS estimated_cost, v.amount_raised::float8 AS amount_raised,
         v.currency, v.city, v.region, v.country, v.country_code, v.relay_point, v.tags, v.rag_text, v.translations,
         v.trust_score, ${TS('v.created_at')} AS created_at, v.organization_name, v.organization_verified,
         b.nickname, b.age
    FROM active_wishes_view v
    LEFT JOIN beneficiaries b ON b.id = v.beneficiary_id
  UNION ALL
  SELECT w.id, w.title, w.description, w.story_context, w.category::text, w.urgency::text,
         w.status::text, w.estimated_cost::float8, w.amount_raised::float8,
         w.currency, w.city, w.region, w.country, w.country_code, w.relay_point, w.tags, w.rag_text, w.translations,
         w.trust_score, ${TS('w.created_at')}, o.name, o.is_verified,
         b.nickname, b.age
    FROM wishes w
    JOIN organizations o ON o.id = w.organization_id
    LEFT JOIN beneficiaries b ON b.id = w.beneficiary_id
   WHERE w.status IN ('funded', 'delivered')`;

// Review queue columns (admin): still no raw_submission.
const REVIEW_COLUMNS = `
  w.id, w.title, w.description, w.story_context, w.category::text AS category, w.urgency::text AS urgency,
  w.status::text AS status, w.estimated_cost::float8 AS estimated_cost, w.amount_raised::float8 AS amount_raised,
  w.currency, w.city, w.region, w.country, w.country_code, w.relay_point, w.tags, w.rag_text, w.translations,
  w.trust_score, w.trust_reasons, w.submission_source, w.review_note,
  ${TS('w.created_at')} AS created_at, ${TS('w.reviewed_at')} AS reviewed_at,
  o.name AS organization_name, o.is_verified AS organization_verified, b.nickname, b.age`;
const REVIEW_FROM = `wishes w JOIN organizations o ON o.id = w.organization_id LEFT JOIN beneficiaries b ON b.id = w.beneficiary_id`;

const NEWS = `
  SELECT id, title, summary, country, country_code, region, severity, needed_categories::text[] AS needed_categories,
         to_char(published_on, 'YYYY-MM-DD') AS published_on, is_mock, translations
    FROM news_items ORDER BY published_on DESC, severity DESC`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function publicWishes() {
    return (await query(`SELECT * FROM (${PUBLIC_WISHES}) x ORDER BY created_at DESC`)).rows;
}

async function publicWish(id) {
    if (!UUID.test(String(id))) return null;
    return (await query(`SELECT * FROM (${PUBLIC_WISHES}) x WHERE id = $1`, [id])).rows[0] || null;
}

async function recentDonations(wishId, limit) {
    return (await query(
        `SELECT id, wish_id, amount::float8 AS amount, donor_display_name, ${TS('donated_at')} AS donated_at
           FROM donations WHERE wish_id = $1 ORDER BY donated_at DESC LIMIT $2`, [wishId, limit || 8])).rows;
}

async function news() {
    return (await query(NEWS)).rows;
}

module.exports = { publicWishes, publicWish, recentDonations, news, REVIEW_COLUMNS, REVIEW_FROM, UUID, TS };
