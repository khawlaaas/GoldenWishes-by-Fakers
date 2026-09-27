/* GET /api/wishes -> { ok, wishes: [DB rows], news: [DB rows] }
 * Everything the public pages need, in one round trip. No private column is selected.
 */
const { json, fail } = require('../lib/nvidia');
const { publicWishes, news } = require('../lib/wishes');

exports.handler = async () => {
    try {
        const [wishes, items] = await Promise.all([publicWishes(), news()]);
        return json(200, { ok: true, wishes, news: items });
    } catch (err) {
        console.error('wishes failed:', err.message);
        return fail(503, 'The wishes could not be loaded from the database. Please try again.', 'db');
    }
};
