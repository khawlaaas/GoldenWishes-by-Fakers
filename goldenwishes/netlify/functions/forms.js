/* POST /api/forms { kind: 'volunteer' | 'partner', data } -> { ok }
 * Website forms, stored in volunteer_applications / partner_requests.
 */
const { json, fail, readBody } = require('../lib/nvidia');
const { query } = require('../lib/db');

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,20}$/;
function s(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

exports.handler = async (event) => {
    const { body, error } = readBody(event);
    if (error) return fail(400, error);
    const d = body.data && typeof body.data === 'object' ? body.data : {};
    try {
        if (body.kind === 'volunteer') {
            const row = { name: s(d.fullName, 100), email: s(d.email, 150), phone: s(d.phone, 30), school: s(d.school, 150), reason: s(d.reason, 2000) };
            if (!row.name || !row.phone || !EMAIL.test(row.email)) return fail(400, 'Name, a valid email and a phone number are required.', 'form_invalid');
            await query(`INSERT INTO volunteer_applications (full_name, email, phone, school, reason) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))`,
                [row.name, row.email, row.phone, row.school, row.reason]);
        } else if (body.kind === 'partner') {
            const row = { org: s(d.companyName, 150), contact: s(d.contactPerson, 100), email: s(d.email, 150), phone: s(d.phone, 30), type: s(d.partnershipType, 50), message: s(d.message, 2000) };
            if (!row.org || !row.contact || !row.phone || !EMAIL.test(row.email)) return fail(400, 'Organization, contact name, a valid email and a phone number are required.', 'form_invalid');
            await query(`INSERT INTO partner_requests (organization_name, contact_person, email, phone, partnership_type, message) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''))`,
                [row.org, row.contact, row.email, row.phone, row.type, row.message]);
        } else {
            return fail(400, 'Unknown form.');
        }
        return json(200, { ok: true });
    } catch (err) {
        console.error('forms failed:', err.message);
        return fail(503, 'Your form could not be sent. Please try again.', 'db');
    }
};
