/* GET /api/db-check — sanity check of the database (read-only in production).
 * Under `netlify dev` only, it also tests the donation trigger: 1 MAD is_demo donation, then reset_demo_donations().
 */
const { query, tx } = require('../lib/db');
const { json, fail } = require('../lib/nvidia');

exports.handler = async () => {
    try {
        const out = {};
        out.wishes_by_status = (await query('SELECT status::text, count(*)::int AS n FROM wishes GROUP BY 1 ORDER BY 1')).rows;
        out.wishes_total = out.wishes_by_status.reduce((s, r) => s + r.n, 0);
        out.news_items = (await query('SELECT count(*)::int AS n FROM news_items')).rows[0].n;
        out.active_wishes_view = (await query('SELECT count(*)::int AS n FROM active_wishes_view')).rows[0].n;
        out.view_columns = (await query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'active_wishes_view' ORDER BY ordinal_position")).rows.map((r) => r.column_name);
        out.categories = (await query('SELECT category::text, count(*)::int AS n FROM wishes GROUP BY 1 ORDER BY 1')).rows;
        out.urgencies = (await query('SELECT urgency::text, count(*)::int AS n FROM wishes GROUP BY 1 ORDER BY 1')).rows;
        out.regions = (await query('SELECT country_code, region, count(*)::int AS n FROM wishes GROUP BY 1, 2 ORDER BY 1, 2')).rows;
        out.news_regions = (await query('SELECT country_code, region, severity, needed_categories::text[] AS cats, (translations <> \'{}\'::jsonb) AS translated FROM news_items ORDER BY published_on DESC')).rows;
        out.wishes_translated = (await query("SELECT count(*)::int AS n FROM wishes WHERE translations <> '{}'::jsonb")).rows[0].n;
        out.wishes_without_beneficiary = (await query('SELECT count(*)::int AS n FROM wishes WHERE beneficiary_id IS NULL')).rows[0].n;
        out.anonymous_donor = (await query("SELECT count(*)::int AS n FROM donors WHERE email = 'anonymous@goldenwishes.local'")).rows[0].n;
        out.independent_org = (await query("SELECT count(*)::int AS n FROM organizations WHERE name = 'Independent submissions (to be assigned)'")).rows[0].n;
        out.demo_donations = (await query('SELECT count(*)::int AS n FROM donations WHERE is_demo')).rows[0].n;

        if (process.env.NETLIFY_DEV === 'true') {
            const w = (await query("SELECT id, title, amount_raised::float AS raised, status::text FROM active_wishes_view WHERE amount_remaining >= 1 ORDER BY created_at LIMIT 1")).rows[0];
            const donor = (await query("SELECT id FROM donors WHERE email = 'anonymous@goldenwishes.local'")).rows[0];
            await tx(async (c) => {
                await c.query('INSERT INTO donations (donor_id, wish_id, amount, donor_display_name, is_demo) VALUES ($1, $2, 1, $3, true)', [donor.id, w.id, 'db-check']);
            });
            const after = (await query('SELECT amount_raised::float AS raised, status::text FROM wishes WHERE id = $1', [w.id])).rows[0];
            let overError = null;
            try {
                await query('INSERT INTO donations (donor_id, wish_id, amount, is_demo) VALUES ($1, $2, 999999, true)', [donor.id, w.id]);
            } catch (err) { overError = err.message; }
            const removed = (await query('SELECT reset_demo_donations() AS n')).rows[0].n;
            const reset = (await query('SELECT amount_raised::float AS raised, status::text FROM wishes WHERE id = $1', [w.id])).rows[0];
            out.trigger_test = { wish: w.title, before: w.raised, before_status: w.status, after_1_mad: after.raised, after_status: after.status,
                over_limit_error: overError, reset_removed: removed, after_reset: reset.raised, after_reset_status: reset.status };
        }
        return json(200, { ok: true, ...out });
    } catch (err) {
        console.error('db-check failed:', err.message);
        return fail(500, 'Database check failed: ' + err.message);
    }
};
