/* Privacy scrub applied to every AI intake draft, whatever the model returned.
 * Removes phone numbers / emails and replaces names found in the original text with initials.
 */
const PHONE = /(\+?212|\b0)[\s.-]?[5-7](?:[\s.-]?\d{2}){4}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const INTRO = /(?:smito|smitha|smiti|smiytha|smiyto|named|called|my name is|his name is|her name is|s'appelle|je m'appelle|nommée?|prénom)\s*:?\s+([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)?)/gi;
const PAIR = /\b([A-ZÀ-Ý][a-zà-ÿ]{2,})\s+([A-ZÀ-Ý][a-zà-ÿ]{2,})\b/g;
// Capitalized words that are not names (places, common sentence starters).
const NOT_NAMES = new Set(('casablanca settat rabat marrakech safi souss massa agadir taroudant fes fès meknes meknès oujda oriental ouarzazate draa drâa tafilalet ' +
    'azrou ifrane dakar senegal sénégal rosso trarza mauritania mauritanie tunisia tunisie kairouan morocco maroc tanger tetouan mohammedia ' +
    'golden wishes the his her their this that salam hello bonjour').split(' '));

function findNames(input) {
    const names = new Set();
    let m;
    while ((m = INTRO.exec(input))) names.add(m[1].trim());
    while ((m = PAIR.exec(input))) {
        if (!NOT_NAMES.has(m[1].toLowerCase()) && !NOT_NAMES.has(m[2].toLowerCase())) names.add(m[1] + ' ' + m[2]);
    }
    return [...names];
}

function scrubText(text, names) {
    let out = String(text || '').replace(PHONE, '[phone removed]').replace(EMAIL, '[email removed]');
    for (const name of names) {
        const parts = name.split(/\s+/);
        const initial = parts[0][0].toUpperCase() + '.';
        // Full name first, then each part on its own.
        out = out.replace(new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), initial);
        for (const part of parts) {
            if (part.length >= 3 && !NOT_NAMES.has(part.toLowerCase())) {
                out = out.replace(new RegExp('\\b' + part + '\\b', 'g'), part[0].toUpperCase() + '.');
            }
        }
    }
    return out.replace(/\b([A-Z])\.\s+\1\./g, '$1.');
}

function scrubDraft(draft, input) {
    const names = findNames(String(input || ''));
    const out = Object.assign({}, draft);
    ['title', 'description', 'backstory', 'beneficiary_alias'].forEach((k) => { out[k] = scrubText(out[k], names); });
    out.privacy_scrubbed = names.length > 0;
    return out;
}

module.exports = { scrubDraft, scrubText, findNames };
