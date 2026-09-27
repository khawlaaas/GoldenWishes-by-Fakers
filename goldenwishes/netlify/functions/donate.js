/* POST /api/donate { wishId, amount, donorName?, email?, phone?, message? } -> { ok, wish, donation }
 * Inserts into donations ONLY (is_demo = true for everything made through the site).
 * The database trigger updates amount_raised, the wish status and the donor total, and refuses
 * donations above what remains or on closed wishes: the app never updates amounts itself.
 */
const { json, fail, readBody } = require('../lib/nvidia');
const { tx } = require('../lib/db');
const { publicWish, UUID } = require('../lib/wishes');

const ANON_EMAIL = 'anonymous@goldenwishes.local';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,20}$/;

function clean(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

// Turn the trigger's RAISE EXCEPTION into a message the UI can show.
function triggerError(err) {
    const msg = String(err && err.message || '');
    const left = msg.match(/\(([\d.]+) MAD left\)/);
    if (/exceeds the remaining amount/i.test(msg)) {
        return { code: 'exceeds_remaining', left: left ? Number(left[1]) : null,
            error: left ? `Only ${Number(left[1])} MAD is still needed for this wish.` : 'This is more than what the wish still needs.' };
    }
    if (/not open for donations/i.test(msg)) return { code: 'not_open', error: 'This wish is not open for donations anymore.' };
    if (/wish not found/i.test(msg)) return { code: 'not_found', error: 'This wish no longer exists.' };
    return null;
}

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const wishId = String(body.wishId || '');
    const amount = Number(body.amount);
    if (!UUID.test(wishId)) return fail(400, 'Unknown wish.', 'not_found');
    if (!isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6 || amount > 100000) {
        return fail(400, 'Please enter an amount above 0 MAD, with at most 2 decimals.', 'invalid_amount');
    }
    const name = clean(body.donorName, 100);
    const email = clean(body.email, 150).toLowerCase();
    if (email && !EMAIL.test(email)) return fail(400, 'This email address does not look valid.', 'invalid_email');
    const phone = clean(body.phone, 30);
    const message = clean(body.message, 300);

    try {
        const donation = await tx(async (c) => {
            let donorId;
            if (email && email !== ANON_EMAIL) {
                // Find or create the donor by email (email is UNIQUE).
                const r = await c.query(
                    `INSERT INTO donors (full_name, email, phone) VALUES ($1, $2, NULLIF($3, ''))
                     ON CONFLICT (email) DO UPDATE SET phone = COALESCE(donors.phone, EXCLUDED.phone)
                     RETURNING id`, [name || 'Donor', email, phone]);
                donorId = r.rows[0].id;
            } else {
                const r = await c.query('SELECT id FROM donors WHERE email = $1', [ANON_EMAIL]);
                if (!r.rows[0]) throw new Error('Anonymous donor row is missing');
                donorId = r.rows[0].id;
            }
            const ins = await c.query(
                `INSERT INTO donations (donor_id, wish_id, amount, donor_display_name, message, is_demo)
                 VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), true)
                 RETURNING id, wish_id, amount::float8 AS amount, donor_display_name,
                           to_char(donated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS donated_at`,
                [donorId, wishId, Math.round(amount * 100) / 100, name, message]);
            return ins.rows[0];
        });
        const wish = await publicWish(wishId);
        return json(200, { ok: true, donation, wish });
    } catch (err) {
        const known = triggerError(err);
        if (known) {
            const wish = await publicWish(wishId).catch(() => null);
            return json(409, { ok: false, code: known.code, left: known.left, error: known.error, wish });
        }
        console.error('donate failed:', err.message);
        return fail(503, 'The donation could not be saved. Please try again.', 'db');
    }
};
