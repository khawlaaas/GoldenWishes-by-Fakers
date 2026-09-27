/* Translate a wish or a news item into French or Arabic with NVIDIA (ONE model call per language).
 * Results go to the translations JSONB column; pages never translate on load.
 */
const { chatJSON } = require('./nvidia');
const { query } = require('./db');

const FIELDS = { wish: ['title', 'description', 'story_context'], news: ['title', 'summary'] };
const TABLE = { wish: 'wishes', news: 'news_items' };
const LANG_NAMES = { fr: 'French', ar: 'Modern Standard Arabic' };

// Arabic text must not keep untranslated English words (3+ Latin letters).
const LATIN_WORD = /[A-Za-z]{3,}/;
// Characters from other scripts (CJK, Cyrillic, Hebrew, Thai...) mean the model slipped: never keep them.
const FOREIGN = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0E00-\u0E7F\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFFFD]/;
const clean = (lang, v) => !FOREIGN.test(v) && !(lang === 'ar' && LATIN_WORD.test(v));

function isDone(row, kind, lang) {
    const tr = row.translations && row.translations[lang];
    return !!tr && FIELDS[kind].every((f) => !row[f] || (typeof tr[f] === 'string' && tr[f].trim() && clean(lang, tr[f])));
}

async function translateRow(kind, row, lang, opts) {
    opts = opts || {};
    const fields = FIELDS[kind].filter((f) => row[f]);
    const source = {};
    fields.forEach((f) => { source[f] = row[f]; });
    const system = `You translate listings of a Moroccan donation platform from English into ${LANG_NAMES[lang]}.
Write natural, warm and dignified ${LANG_NAMES[lang]} for readers in Morocco. Translate faithfully: do not add, remove or invent information.
Keep numbers as digits and keep people's nicknames and place names (use their usual ${LANG_NAMES[lang]} spelling).
Reply with ONLY a JSON object with exactly the same keys as the input: ${JSON.stringify(fields)}.`;
    return chatJSON({
        system, user: JSON.stringify(source), maxTokens: opts.maxTokens || 1200,
        budgetMs: opts.budgetMs || 9000, callTimeoutMs: opts.callTimeoutMs, model: opts.model,
        validate: (p) => {
            if (!p || typeof p !== 'object') return null;
            const out = {};
            for (const f of fields) {
                if (typeof p[f] !== 'string' || !p[f].trim()) return null;
                out[f] = p[f].trim().slice(0, 4000);
            }
            // Arabic output must actually be in Arabic script, and no field may contain a slip (foreign script, English words in Arabic).
            if (lang === 'ar' && !/[؀-ۿ]/.test(out[fields[0]])) return null;
            if (fields.some((f) => !clean(lang, out[f]))) return null;
            return out;
        },
    });
}

async function saveTranslation(kind, id, lang, value) {
    await query(`UPDATE ${TABLE[kind]} SET translations = translations || jsonb_build_object($2::text, $3::jsonb) WHERE id = $1`,
        [id, lang, JSON.stringify(value)]);
}

module.exports = { FIELDS, isDone, translateRow, saveTranslation };
