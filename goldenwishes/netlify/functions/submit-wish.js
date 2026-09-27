/* POST /api/submit-wish { offer, trust?, raw_text?, submitted_by? } -> { ok, id }
 * Saves an AI-intake submission as a wish with status pending_review, attached to the
 * "Independent submissions (to be assigned)" organization. Nothing is public before a reviewer approves it.
 * raw_submission (the original text) is stored for reviewers only and never returned by any endpoint.
 */
const { json, fail, readBody } = require('../lib/nvidia');
const { query } = require('../lib/db');
const { validateOffer } = require('../../js/data/schema.js');
const { urgencyToEnum } = require('../../js/data/mapping.js');
const { scrubText } = require('../lib/privacy');

const ORG = 'Independent submissions (to be assigned)';

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const o = body.offer && typeof body.offer === 'object' ? body.offer : null;
    if (!o) return fail(400, 'Send the listing to save.');
    const offer = {
        title: String(o.title || '').trim(), description: String(o.description || '').trim(), backstory: String(o.backstory || '').trim(),
        category: o.category, tags: Array.isArray(o.tags) ? o.tags.filter((t) => typeof t === 'string').map((t) => t.trim().toLowerCase().slice(0, 30)).slice(0, 6) : [],
        country: 'Morocco', country_code: 'MA', region: String(o.region || '').trim(), city: String(o.city || '').trim(),
        urgency: Math.round(Number(o.urgency)), total_price: Math.round(Number(o.total_price) * 100) / 100, currency: 'MAD',
    };
    const problems = validateOffer(offer);
    if (problems.length) return fail(400, 'Please fix: ' + problems.join('; '));

    let trustScore = null, trustReasons = [];
    if (body.trust && typeof body.trust === 'object') {
        const sc = Math.round(Number(body.trust.score));
        if (sc >= 0 && sc <= 100) trustScore = sc;
        if (Array.isArray(body.trust.reasons)) trustReasons = body.trust.reasons.filter((r) => typeof r === 'string').map((r) => r.slice(0, 300)).slice(0, 10);
    }
    const raw = typeof body.raw_text === 'string' ? body.raw_text.slice(0, 4000) : null;
    const by = typeof body.submitted_by === 'string' ? body.submitted_by.trim().slice(0, 100) : '';
    // Public text is scrubbed again in code (phones / emails), whatever the client sent.
    const pub = (t) => scrubText(t, []);

    try {
        const org = await query('SELECT id FROM organizations WHERE name = $1 LIMIT 1', [ORG]);
        if (!org.rows[0]) return fail(503, 'The submissions organization is missing in the database.');
        const r = await query(
            `INSERT INTO wishes (organization_id, category, title, description, story_context, estimated_cost, currency, urgency, status,
                                 relay_point, city, region, country, country_code, tags,
                                 trust_score, trust_reasons, submission_source, raw_submission, review_note)
             VALUES ($1, $2::wish_category, $3, $4, $5, $6, 'MAD', $7::urgency_level, 'pending_review',
                     'Relay point — to be assigned', $8, $9, 'Morocco', 'MA', $10,
                     $11, $12::jsonb, 'ai_intake', $13, $14)
             RETURNING id`,
            [org.rows[0].id, offer.category, pub(offer.title).slice(0, 150), pub(offer.description), pub(offer.backstory), offer.total_price,
             urgencyToEnum(offer.urgency), offer.city.slice(0, 80), offer.region.slice(0, 80), offer.tags,
             trustScore, JSON.stringify(trustReasons), raw, by ? 'Submitted by: ' + by : null]);
        return json(200, { ok: true, id: r.rows[0].id });
    } catch (err) {
        console.error('submit-wish failed:', err.message);
        return fail(503, 'The submission could not be saved. Please try again.', 'db');
    }
};
