/* GET /api/review-queue -> { ok, pending: [rows], recent: [rows] }  (reviewer only)
 * Pending AI-intake submissions plus the latest reviewed ones. raw_submission is never selected.
 */
const { json, fail } = require('../lib/nvidia');
const { query } = require('../lib/db');
const { requireReviewer } = require('../lib/auth');
const { REVIEW_COLUMNS, REVIEW_FROM } = require('../lib/wishes');

exports.handler = async (event) => {
    const denied = requireReviewer(event);
    if (denied) return denied;
    try {
        const pending = (await query(`SELECT ${REVIEW_COLUMNS} FROM ${REVIEW_FROM} WHERE w.status = 'pending_review' ORDER BY w.created_at DESC`)).rows;
        const recent = (await query(`SELECT ${REVIEW_COLUMNS} FROM ${REVIEW_FROM}
            WHERE w.reviewed_at IS NOT NULL AND w.status IN ('open', 'partially_funded', 'funded', 'delivered', 'rejected')
            ORDER BY w.reviewed_at DESC LIMIT 20`)).rows;
        return json(200, { ok: true, pending, recent });
    } catch (err) {
        console.error('review-queue failed:', err.message);
        return fail(503, 'The review queue could not be loaded.', 'db');
    }
};
