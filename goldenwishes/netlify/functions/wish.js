/* GET /api/wish?id=<uuid> -> { ok, wish, donations }  (public columns only) */
const { json, fail } = require('../lib/nvidia');
const { publicWish, recentDonations } = require('../lib/wishes');

exports.handler = async (event) => {
    const id = (event.queryStringParameters || {}).id;
    try {
        const wish = await publicWish(id);
        if (!wish) return fail(404, 'This wish does not exist or is not public.', 'not_found');
        return json(200, { ok: true, wish, donations: await recentDonations(wish.id, 8) });
    } catch (err) {
        console.error('wish failed:', err.message);
        return fail(503, 'This wish could not be loaded. Please try again.', 'db');
    }
};
