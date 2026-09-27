/* POST /api/intake  { text } -> { ok, draft }
 * ONE model call: turn a messy description of a need into a clean, anonymized offer draft.
 * The price is only copied from the text (never estimated); the submitter confirms it in the form.
 */
const { config, json, fail, readBody, chatJSON } = require('../lib/nvidia');
const { cannedIntake } = require('../lib/canned');
const { PLACES } = require('../../js/features/chat/local-parse.js');
const { scrubDraft } = require('../lib/privacy');

const { CATEGORIES } = require('../../js/data/schema.js');
const COUNTRIES = { MA: 'Morocco' };
const { MA_REGIONS } = require('../../js/features/chat/local-parse.js');

const SYSTEM = `You help a donation platform that works with verified partner organizations in Morocco turn a messy description of a need into a clean public listing.
The input may be in English, French, Arabic or Darija. Write the output in English.
PRIVACY RULES (mandatory): use initials only for people, everywhere including the backstory (e.g. "Amine Tazi, 8" becomes "A., 8"); remove phone numbers, emails, exact addresses, and names of schools, hospitals or employers; never include payment details.
Keep facts from the text; do not invent details. Keep the backstory 3-5 sentences, factual and dignified.

Reply with ONLY a JSON object:
{
  "title": "short concrete item or service, max 60 chars",
  "description": "one-line summary, max 120 chars",
  "backstory": "3-5 anonymized sentences",
  "beneficiary_alias": "initials and age, e.g. 'S., 11' or 'K. family'",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "tags": ["2-4 lowercase tags"],
  "country_code": one of ${JSON.stringify(Object.keys(COUNTRIES))},
  "region": "for Morocco one of ${MA_REGIONS.join(', ')}; otherwise the region/province name",
  "city": "city or town",
  "urgency": 1, 3, 4 or 5 (5 = critical, life or safety at risk now; 4 = high; 3 = medium; 1 = low, nice to have),
  "total_price": number in MAD ONLY if the text states a price or cost, else null
}`;

function validate(p) {
    if (!p || typeof p !== 'object') return null;
    const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const title = str(p.title, 80), description = str(p.description, 160), backstory = str(p.backstory, 1200);
    if (!title || !description || !backstory) return null;
    const cc = COUNTRIES[p.country_code] ? p.country_code : 'MA';
    let region = str(p.region, 60);
    if (cc === 'MA' && !MA_REGIONS.includes(region)) {
        const place = PLACES.find((pl) => pl.region && region && pl.region.toLowerCase() === region.toLowerCase());
        region = place ? place.region : 'Casablanca-Settat';
    }
    let price = typeof p.total_price === 'string' ? parseFloat(p.total_price) : p.total_price;
    price = typeof price === 'number' && isFinite(price) && price > 0 && price < 1000000 ? Math.round(price) : null;
    const urgency = Math.min(5, Math.max(1, parseInt(p.urgency, 10) || 3));
    return {
        title, description, backstory,
        beneficiary_alias: str(p.beneficiary_alias, 40) || 'Anonymous',
        category: CATEGORIES.includes(p.category) ? p.category : 'essentials',
        tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string').map((t) => t.toLowerCase().slice(0, 20)).slice(0, 4) : [],
        country: COUNTRIES[cc], country_code: cc,
        region: region || 'Unknown',
        city: str(p.city, 60) || (region || '').split('-')[0] || 'Unknown',
        urgency,
        total_price: price,
        source: 'nvidia',
    };
}

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
    if (text.length < 20) return fail(400, 'Please describe the need in a few sentences.');

    if (config().demoFallback) return json(200, { ok: true, draft: scrubDraft(cannedIntake(text), text) });

    const r = await chatJSON({ system: SYSTEM, user: text, maxTokens: 600, validate });
    if (!r.ok) return fail(502, r.error, r.code);
    // Never trust the model alone with privacy: scrub names / phones / emails in code too.
    return json(200, { ok: true, draft: scrubDraft(r.value, text), model: config().chatModel });
};
