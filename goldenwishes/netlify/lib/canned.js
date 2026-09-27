/* Canned answers used when DEMO_FALLBACK=true (no network needed on stage). */
const { parseLocal, parseBudget } = require('../../js/features/chat/local-parse.js');
const { translator } = require('./i18n');

function cannedParse(message) {
    return Object.assign(parseLocal(message), { source: 'demo_fallback' });
}

// Same sentences as the browser fallback, in the site language.
function cannedExplain(language, items) {
    const t = translator(language);
    const reasons = {};
    items.forEach((o) => { reasons[o.id] = t('chat.reason', { title: o.title, city: o.city }); });
    return { intro: t('chat.intro'), reasons, source: 'demo_fallback' };
}
/* ---- Feature 7 canned answers ---- */


// Polished answer for the example used on stage (the "Use an example" button on #/make-a-wish).
const EXAMPLE_DRAFT = {
    title: 'Prescription glasses for an 8-year-old',
    description: 'An eye exam and glasses for a boy who cannot see the board in class.',
    backstory: 'A. is eight and lives in Agadir. He cannot see clearly in class, and his teacher said he needs glasses. His parents cannot afford them right now. A pair of prescription glasses would let him follow his lessons again.',
    beneficiary_alias: 'A., 8', category: 'health', tags: ['children', 'school', 'eyes'],
    country: 'Morocco', country_code: 'MA', region: 'Souss-Massa', city: 'Agadir', urgency: 3, total_price: 400,
};

// Rough offer draft from messy text, without AI.
function cannedIntake(text) {
    if (/nwader/i.test(text) && /agadir/i.test(text)) return Object.assign({}, EXAMPLE_DRAFT, { source: 'demo_fallback' });
    const p = parseLocal(text);
    const clean = String(text)
        .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
        .replace(/(\+?212|\b0)[\s.-]?[5-7](?:[\s.-]?\d{2}){4}\b/g, '[phone removed]')
        .trim();
    const first = clean.split(/[.!?\n]/)[0].trim();
    const place = p.region ? { region: p.region, country_code: p.country_code } : { region: 'Casablanca-Settat', country_code: 'MA' };
    return {
        title: first.slice(0, 70) || 'New need',
        description: first.slice(0, 140) || clean.slice(0, 140),
        backstory: clean.slice(0, 900),
        beneficiary_alias: 'Anonymous',
        category: p.categories[0] || 'essentials',
        tags: [],
        country: 'Morocco',
        country_code: 'MA',
        region: place.region,
        city: place.region.split('-')[0],
        urgency: 3,
        total_price: parseBudget(text),
        source: 'demo_fallback',
    };
}

module.exports = { cannedParse, cannedExplain, cannedIntake };
