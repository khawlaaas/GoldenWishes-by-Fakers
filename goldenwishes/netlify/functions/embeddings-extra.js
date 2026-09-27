/* GET /api/embeddings-extra -> { ok, offers: { [id]: { hash, v } } }
 * Vectors of wishes approved after the static cache was built (Netlify Blobs). Merged in the browser.
 */
const { json } = require('../lib/nvidia');
const { store } = require('../lib/embeddings-store');

exports.handler = async (event) => {
    try {
        const s = store(event);
        const { blobs } = await s.list();
        const offers = {};
        await Promise.all(blobs.slice(0, 200).map(async (b) => {
            const v = await s.get(b.key, { type: 'json' });
            if (v && v.hash && Array.isArray(v.v)) offers[b.key] = { hash: v.hash, v: v.v };
        }));
        return json(200, { ok: true, offers });
    } catch (err) {
        // No blobs available (e.g. first run): the chat still has the static cache and TF-IDF.
        console.warn('embeddings-extra:', err.message);
        return json(200, { ok: true, offers: {} });
    }
};
