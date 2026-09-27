/* POST /api/translate-wish { id, lang: 'fr' | 'ar' } -> { ok }  (reviewer only)
 * Called right after a wish is approved (once per language): ONE model call, stored in wishes.translations.
 */
const { config, json, fail, readBody } = require('../lib/nvidia');
const { query } = require('../lib/db');
const { requireReviewer } = require('../lib/auth');
const { UUID } = require('../lib/wishes');
const { isDone, translateRow, saveTranslation } = require('../lib/translate');

exports.handler = async (event) => {
    const denied = requireReviewer(event);
    if (denied) return denied;
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const id = String(body.id || ''), lang = body.lang;
    if (!UUID.test(id) || !['fr', 'ar'].includes(lang)) return fail(400, 'Send a wish id and lang fr or ar.');
    if (config().demoFallback) return json(200, { ok: true, skipped: 'demo_fallback' });
    try {
        const row = (await query('SELECT id, title, description, story_context, translations FROM wishes WHERE id = $1', [id])).rows[0];
        if (!row) return fail(404, 'Unknown wish.', 'not_found');
        if (isDone(row, 'wish', lang)) return json(200, { ok: true, already: true });
        const r = await translateRow('wish', row, lang, { budgetMs: 9500, callTimeoutMs: 9000 });
        if (!r.ok) return fail(502, r.error, r.code);
        await saveTranslation('wish', id, lang, r.value);
        return json(200, { ok: true });
    } catch (err) {
        console.error('translate-wish failed:', err.message);
        return fail(503, 'The translation could not be saved.', 'db');
    }
};
