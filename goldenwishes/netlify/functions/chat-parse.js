/* POST /api/chat-parse  { message, context? } -> { ok, parsed }
 * ONE model call: turn a free-text donor message (Darija, French, English, Arabic) into structured intent.
 * The model never does money math: it only reads the amount the donor typed.
 */
const { config, json, fail, readBody, chatJSON } = require('../lib/nvidia');
const { cannedParse } = require('../lib/canned');
const { PLACES } = require('../../js/features/chat/local-parse.js');

const { CATEGORIES } = require('../../js/data/schema.js');
const LANGS = ['en', 'fr', 'darija', 'ar'];
const REGIONS = PLACES.filter((p) => p.region).map((p) => p.country_code + ': ' + p.region);

const SYSTEM = `You read messages from donors on Golden Wishes, a Moroccan charity platform, and extract what they want.
Messages may be in English, French, Arabic, or Moroccan Darija written in Latin letters with digits (3=ع, 7=ح, 9=ق).
Darija hints: 3ndi = I have, bghit = I want, n3awen = to help, drari / wlad = children, l9raya = school/studies, makla = food, dwa = medicine, dar = house, bard = cold, dh = dirhams (MAD).

Reply with ONLY a JSON object, no other text:
{
  "budget": number or null,         // the amount in MAD the donor says they can give; null if not stated. Do not invent one.
  "categories": [..],               // 0-3 of: ${CATEGORIES.join(', ')}
  "country_code": "MA"|null,
  "region": string or null,         // only one of: ${REGIONS.join('; ')}
  "query_en": string,               // one short English sentence describing the kind of need to find (for semantic search)
  "language": "en"|"fr"|"darija"|"ar"   // the language the donor wrote in
}`;

function validate(p) {
    if (!p || typeof p !== 'object') return null;
    let budget = p.budget;
    if (typeof budget === 'string') budget = parseFloat(budget.replace(/[^\d.]/g, ''));
    if (typeof budget !== 'number' || !isFinite(budget) || budget <= 0 || budget > 1000000) budget = null;
    const categories = Array.isArray(p.categories) ? p.categories.filter((c) => CATEGORIES.includes(c)).slice(0, 3) : [];
    const place = PLACES.find((pl) => pl.region && pl.region === p.region);
    const cc = p.country_code === 'MA' ? 'MA' : (place ? place.country_code : null);
    const query = typeof p.query_en === 'string' && p.query_en.trim() ? p.query_en.trim().slice(0, 300) : null;
    if (!query) return null;
    return {
        budget: budget === null ? null : Math.floor(budget),
        categories,
        country_code: cc,
        region: place ? place.region : null,
        query_en: query,
        language: LANGS.includes(p.language) ? p.language : 'en',
        source: 'nvidia',
    };
}

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 600) : '';
    if (!message) return fail(400, 'Please type a message.');

    if (config().demoFallback) return json(200, { ok: true, parsed: cannedParse(message) });

    const r = await chatJSON({ system: SYSTEM, user: message, maxTokens: 250, validate });
    if (!r.ok) return fail(502, r.error, r.code);
    // Safety net: if the model missed a budget the donor clearly typed, read it directly from the text.
    if (r.value.budget === null) r.value.budget = cannedParse(message).budget;
    return json(200, { ok: true, parsed: r.value, model: config().chatModel });
};
