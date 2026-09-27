/* POST /api/embed-wish { id } -> { ok }  (reviewer only)
 * ONE embeddings call on the wish's rag_text (built by the database trigger), stored in Netlify Blobs
 * so the chat assistant can recommend a wish approved after the static cache was built.
 */
const { config, json, fail, readBody, embed } = require('../lib/nvidia');
const { query } = require('../lib/db');
const { requireReviewer } = require('../lib/auth');
const { UUID } = require('../lib/wishes');
const { store } = require('../lib/embeddings-store');
const { textHash } = require('../../js/data/mapping.js');

exports.handler = async (event) => {
    const denied = requireReviewer(event);
    if (denied) return denied;
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const id = String(body.id || '');
    if (!UUID.test(id)) return fail(400, 'Unknown wish.');
    if (config().demoFallback) return json(200, { ok: true, skipped: 'demo_fallback' });
    try {
        const row = (await query(`SELECT rag_text FROM wishes WHERE id = $1 AND status IN ('open', 'partially_funded')`, [id])).rows[0];
        if (!row || !row.rag_text) return fail(404, 'Only open wishes are embedded.');
        const r = await embed([row.rag_text], 'passage');
        if (!r.ok) return fail(502, r.error);
        const v = r.vectors[0].map((x) => Math.round(x * 10000) / 10000);
        await store(event).setJSON(id, { hash: textHash(row.rag_text), v, model: config().embedModel });
        return json(200, { ok: true, dim: v.length });
    } catch (err) {
        console.error('embed-wish failed:', err.message);
        return fail(503, 'The wish could not be embedded.');
    }
};
