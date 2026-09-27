/* Reviewer check for admin endpoints (review queue, approve/reject, reset demo data).
 * The site is public, so these need the x-review-code header to match REVIEW_CODE.
 * Under `netlify dev` with no REVIEW_CODE set, they stay open for local testing.
 */
const crypto = require('crypto');
const { fail } = require('./nvidia');

function requireReviewer(event) {
    const expected = process.env.REVIEW_CODE || '';
    if (!expected) {
        if (process.env.NETLIFY_DEV === 'true') return null;
        return fail(403, 'Review is disabled on this site: set REVIEW_CODE in the Netlify environment variables.', 'review_disabled');
    }
    const headers = event.headers || {};
    const given = String(headers['x-review-code'] || headers['X-Review-Code'] || '');
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    if (!given || !crypto.timingSafeEqual(a, b)) return fail(401, 'Wrong or missing review code.', 'bad_code');
    return null;
}

module.exports = { requireReviewer };
