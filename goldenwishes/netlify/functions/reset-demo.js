/* POST /api/reset-demo -> { ok, removed }  (reviewer only)
 * Calls reset_demo_donations(): removes donations flagged is_demo and gives the amounts back.
 * The team's seed data is never touched.
 */
const { json, fail } = require('../lib/nvidia');
const { query } = require('../lib/db');
const { requireReviewer } = require('../lib/auth');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return fail(400, 'Use POST.');
    const denied = requireReviewer(event);
    if (denied) return denied;
    try {
        const r = await query('SELECT reset_demo_donations() AS removed');
        return json(200, { ok: true, removed: r.rows[0].removed });
    } catch (err) {
        console.error('reset-demo failed:', err.message);
        return fail(503, 'The demo data could not be reset. Please try again.', 'db');
    }
};
