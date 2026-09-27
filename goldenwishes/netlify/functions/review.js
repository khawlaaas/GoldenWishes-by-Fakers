/* POST /api/review { id, action: 'approve' | 'reject' | 'restore' | 'trust', trust? } -> { ok, wish }  (reviewer only)
 * approve: status open + reviewed_at; reject: status rejected + reviewed_at; restore: back to pending_review;
 * trust: store the trust check result. Nothing is ever deleted.
 */
const { json, fail, readBody } = require('../lib/nvidia');
const { query } = require('../lib/db');
const { requireReviewer } = require('../lib/auth');
const { REVIEW_COLUMNS, REVIEW_FROM, UUID } = require('../lib/wishes');

exports.handler = async (event) => {
    const denied = requireReviewer(event);
    if (denied) return denied;
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const id = String(body.id || '');
    if (!UUID.test(id)) return fail(400, 'Unknown wish.');
    try {
        let r;
        if (body.action === 'approve') {
            r = await query(`UPDATE wishes SET status = 'open', reviewed_at = now() WHERE id = $1 AND status = 'pending_review' RETURNING id`, [id]);
        } else if (body.action === 'reject') {
            r = await query(`UPDATE wishes SET status = 'rejected', reviewed_at = now() WHERE id = $1 AND status = 'pending_review' RETURNING id`, [id]);
        } else if (body.action === 'restore') {
            r = await query(`UPDATE wishes SET status = 'pending_review', reviewed_at = NULL WHERE id = $1 AND status = 'rejected' RETURNING id`, [id]);
        } else if (body.action === 'trust') {
            const t = body.trust || {};
            const score = Math.round(Number(t.score));
            if (!(score >= 0 && score <= 100)) return fail(400, 'Trust score must be 0-100.');
            const reasons = Array.isArray(t.reasons) ? t.reasons.filter((x) => typeof x === 'string').map((x) => x.slice(0, 300)).slice(0, 10) : [];
            r = await query(`UPDATE wishes SET trust_score = $2, trust_reasons = $3::jsonb WHERE id = $1 AND status = 'pending_review' RETURNING id`,
                [id, score, JSON.stringify(reasons)]);
        } else {
            return fail(400, 'Unknown action.');
        }
        if (!r.rows[0]) return fail(409, 'This wish was already reviewed.', 'already_reviewed');
        const wish = (await query(`SELECT ${REVIEW_COLUMNS} FROM ${REVIEW_FROM} WHERE w.id = $1`, [id])).rows[0];
        return json(200, { ok: true, wish });
    } catch (err) {
        console.error('review failed:', err.message);
        return fail(503, 'The review decision could not be saved.', 'db');
    }
};
