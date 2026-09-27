/* POST /api/trust-check  { offer } -> { ok, trust: { score, reasons, level, rules_score, ai } }
 * Deterministic rules first (js/features/intake/trust-rules.js), then ONE model call for a second opinion.
 * Final score = rules score adjusted by the AI's risk level, clamped to 0-100. Computed here, not by the model.
 */
const { config, json, fail, readBody, chatJSON } = require('../lib/nvidia');
const { checkRules, level } = require('../../js/features/intake/trust-rules.js');
const { translator } = require('../lib/i18n');
const { query } = require('../lib/db');

// Reference prices: public wishes from verified organizations.
async function referenceOffers() {
    try {
        const r = await query(`SELECT w.id, w.category::text AS category, w.estimated_cost::float8 AS total_price, o.name AS verified_by
            FROM wishes w JOIN organizations o ON o.id = w.organization_id
            WHERE o.is_verified AND w.status IN ('open', 'partially_funded', 'funded', 'delivered')`);
        return r.rows;
    } catch (err) {
        console.error('trust-check references failed:', err.message);
        return [];
    }
}

const AI_ADJUST = { low: 5, medium: -10, high: -25 };

const SYSTEM = `You are a fraud and privacy reviewer for a Moroccan donation platform that lists concrete needs (items or services) for vulnerable people, verified by partner organizations.
Legitimate listings: modest, concrete items (school supplies, blankets, food, medicine, repairs), anonymized stories (initials only), payment only through the platform and its partner organizations.
Red flags: luxury or high-resale items, prices far above what the item costs, pressure to pay fast, requests to pay the person directly, contact details, full names, vague stories, inconsistencies.
Reply with ONLY a JSON object: {"risk": "low"|"medium"|"high", "reasons": ["1 to 3 short sentences, specific to this listing"]}`;
const LANG_NAMES = { en: 'English', fr: 'French', ar: 'Arabic (Modern Standard)' };

function combine(rules, ai, t) {
    let score = rules.score + (ai ? AI_ADJUST[ai.risk] : 0);
    score = Math.max(0, Math.min(100, score));
    const reasons = rules.flags.map((f) => f.reason);
    if (ai) ai.reasons.forEach((r) => reasons.push(t('trust.aiPrefix', { reason: r })));
    if (!reasons.length) reasons.push(t('trust.none'));
    return { score, reasons, level: level(score, t).key, rules_score: rules.score, ai };
}

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const o = body.offer;
    if (!o || typeof o !== 'object' || typeof o.title !== 'string') return fail(400, 'Send the offer to check.');
    const offer = {
        id: String(o.id || ''), title: String(o.title).slice(0, 120), description: String(o.description || '').slice(0, 300),
        backstory: String(o.backstory || '').slice(0, 1500), beneficiary_alias: String(o.beneficiary_alias || '').slice(0, 60),
        category: String(o.category || ''), city: String(o.city || ''), region: String(o.region || ''),
        total_price: Number(o.total_price) || 0, urgency: Number(o.urgency) || 3, verified_by: o.verified_by || null,
    };
    const lang = ['en', 'fr', 'ar'].includes(body.lang) ? body.lang : 'en';
    const t = translator(lang);
    const rules = checkRules(offer, await referenceOffers(), t);

    if (config().demoFallback) return json(200, { ok: true, trust: combine(rules, null, t), source: 'demo_fallback' });

    const user = `Listing:\nTitle: ${offer.title}\nSummary: ${offer.description}\nStory: ${offer.backstory}\nBeneficiary shown as: ${offer.beneficiary_alias}\n` +
        `Category: ${offer.category}\nPlace: ${offer.city}, ${offer.region}\nPrice asked: ${offer.total_price} MAD\nUrgency claimed: ${offer.urgency}/5`;
    const r = await chatJSON({
        system: SYSTEM + `\nWrite the reasons in ${LANG_NAMES[lang]}.`, user, maxTokens: 350,
        validate: (p) => {
            if (!p || !['low', 'medium', 'high'].includes(p.risk) || !Array.isArray(p.reasons)) return null;
            const reasons = p.reasons.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 240)).slice(0, 3);
            return reasons.length ? { risk: p.risk, reasons } : null;
        },
    });
    // If the AI is unavailable, the rules alone still give a usable answer.
    if (!r.ok) return json(200, { ok: true, trust: combine(rules, null, t), ai_error: r.error });
    return json(200, { ok: true, trust: combine(rules, r.value, t), model: config().chatModel });
};
