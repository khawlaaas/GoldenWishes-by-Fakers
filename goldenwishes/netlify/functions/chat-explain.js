/* POST /api/chat-explain  { message, language, budget, items: [{ id, title, description, category, city, region, urgency, total_price, remaining, amount }] }
 *   -> { ok, intro, reasons: { [id]: sentence } }
 * ONE model call. The allocation was computed in the browser; here we re-validate the money
 * and ask the model ONLY for words (no numbers). The UI shows the JS-computed amounts.
 */
const { config, json, fail, readBody, chatJSON } = require('../lib/nvidia');
const { cannedExplain } = require('../lib/canned');
const { query } = require('../lib/db');
const { UUID } = require('../lib/wishes');

// The answer follows the language chosen on the site (the donor may have written in Darija).
const LANG_NAMES = { en: 'English', fr: 'French', ar: 'Arabic (Modern Standard)', darija: 'Moroccan Darija written in Latin letters (like the donor)' };

const cents = (n) => Math.round(Number(n) * 100);

// Server-side check of the allocation computed in the browser, against the live amounts in the database.
async function checkAllocation(budget, items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 3) return 'Expected 1 to 3 offers.';
    let sum = 0;
    for (const it of items) {
        if (!it || typeof it.id !== 'string' || !UUID.test(it.id) || typeof it.title !== 'string') return 'Each offer needs an id and a title.';
        if (typeof it.amount !== 'number' || !(it.amount > 0) || Math.abs(it.amount * 100 - cents(it.amount)) > 1e-6) return 'Amounts must be positive MAD, at most 2 decimals.';
        sum += cents(it.amount);
    }
    if (typeof budget === 'number' && sum > cents(budget)) return 'The split is larger than the budget.';
    const rows = (await query('SELECT id, amount_remaining::float8 AS left FROM active_wishes_view WHERE id = ANY($1::uuid[])', [items.map((it) => it.id)])).rows;
    for (const it of items) {
        const row = rows.find((r) => r.id === it.id);
        if (!row) return 'One of these wishes is no longer open.';
        if (cents(it.amount) > cents(row.left)) return 'An amount exceeds what the wish still needs.';
    }
    return null;
}

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const budget = typeof body.budget === 'number' ? body.budget : null;
    const items = Array.isArray(body.items) ? body.items.slice(0, 3) : [];
    let problem;
    try { problem = await checkAllocation(budget, items); } catch (err) { console.error('chat-explain check failed:', err.message); problem = 'The wishes could not be checked right now.'; }
    if (problem) return fail(400, problem);
    const language = LANG_NAMES[body.language] ? body.language : 'en';

    if (config().demoFallback) return json(200, Object.assign({ ok: true }, cannedExplain(language, items)));

    const system = `You write short, warm explanations for a charity platform. Reply in ${LANG_NAMES[language]}.
Never write any number, amount or currency: the app already shows the amounts. Never invent facts beyond what is given.
Reply with ONLY a JSON object: {"intro": "one sentence", "reasons": {"<offer id>": "one sentence on why this wish fits the donor's request"}}`;
    const user = 'Donor message: ' + String(body.message || '').slice(0, 400) + '\n\nChosen wishes:\n' +
        items.map((o) => `- id ${o.id}: "${o.title}" (${o.category}, ${o.city}, ${o.region}, urgency ${o.urgency}/5). ${String(o.description || '').slice(0, 200)}`).join('\n');

    const ids = items.map((o) => o.id);
    const r = await chatJSON({
        system, user, maxTokens: 550,
        validate: (p) => {
            if (!p || typeof p.intro !== 'string' || !p.reasons || typeof p.reasons !== 'object') return null;
            const reasons = {};
            for (const id of ids) {
                if (typeof p.reasons[id] !== 'string' || !p.reasons[id].trim()) return null;
                reasons[id] = p.reasons[id].trim().slice(0, 300);
            }
            return { intro: p.intro.trim().slice(0, 300), reasons, source: 'nvidia' };
        },
    });
    if (!r.ok) return fail(502, r.error, r.code);
    return json(200, Object.assign({ ok: true, model: config().chatModel }, r.value));
};
