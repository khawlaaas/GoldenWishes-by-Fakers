/* POST /api/embed  { text } -> { ok, vector, model }
 * ONE embeddings call for the donor's query (offers are precomputed by scripts/embed-offers.js).
 */
const { config, json, fail, readBody, embed } = require('../lib/nvidia');

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : '';
    if (!text) return fail(400, 'Nothing to embed.');

    // No vector in demo mode: the browser falls back to TF-IDF matching.
    if (config().demoFallback) return json(200, { ok: true, vector: null, source: 'demo_fallback' });

    const r = await embed([text], 'query');
    if (!r.ok) return fail(502, r.error, r.code);
    return json(200, { ok: true, vector: r.vectors[0], model: config().embedModel });
};
