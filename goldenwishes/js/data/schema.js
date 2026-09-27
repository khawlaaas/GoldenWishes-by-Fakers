/* Golden Wishes — shared schema. Every other feature reads from this.
 * The source of truth is the Postgres database (see the database repo's README); js/data/mapping.js
 * turns DB rows into these front-end shapes.
 *
 * Offer:
 *   { id (UUID), title, description (one line, shown on card),
 *     backstory (from story_context, anonymized), beneficiary_alias: "Nour, 9" (nickname + age),
 *     category (one of CATEGORIES, DB enum keys), tags: [..],
 *     country, country_code, region, city, urgency: 1-5 (low=1, medium=3, high=4, critical=5),
 *     total_price (estimated_cost), currency: "MAD", amount_raised (updated by the DB trigger only),
 *     status: "open" | "funded" | "pending_review" | "rejected"  (db_status keeps the exact DB value),
 *     verified_by: organization name if verified | null, trust: { score 0-100, reasons: [..] } | null,
 *     relay_point, rag_text, image_url: null, created_at: ISO string }
 * Contribution: { id, offer_id, amount, donor_name, created_at }
 * NewsItem: { id, title, summary, country, country_code, region, date, severity: 1-5, needed_categories: [], is_mock }
 *
 * Loaded in the browser (window.GW.schema) and by Node (module.exports) for server-side validation.
 */
(function (root) {
    var CATEGORIES = ['education', 'essentials', 'creative', 'family_care', 'health', 'clothing', 'technology', 'sport', 'shelter', 'food'];
    var CATEGORY_LABELS = {
        education: 'Education', essentials: 'Essentials', creative: 'Creative', family_care: 'Family care', health: 'Health',
        clothing: 'Clothing', technology: 'Technology', sport: 'Sport', shelter: 'Shelter', food: 'Food'
    };
    var STATUSES = ['open', 'funded', 'pending_review', 'rejected'];

    function isMoney(n) { return typeof n === 'number' && isFinite(n) && Math.round(n * 100) === n * 100; }

    // Returns a list of problems; an empty list means the offer is valid.
    function validateOffer(o) {
        var errors = [];
        if (!o || typeof o !== 'object') return ['offer must be an object'];
        function str(k, max) {
            if (typeof o[k] !== 'string' || !o[k].trim()) errors.push(k + ' is required');
            else if (max && o[k].length > max) errors.push(k + ' is too long');
        }
        str('title', 150); str('description', 240); str('backstory', 1500);
        str('country'); str('country_code'); str('region', 80); str('city', 80);
        if (CATEGORIES.indexOf(o.category) === -1) errors.push('category must be one of ' + CATEGORIES.join(', '));
        if (!Array.isArray(o.tags)) errors.push('tags must be a list');
        if (!Number.isInteger(o.urgency) || o.urgency < 1 || o.urgency > 5) errors.push('urgency must be 1-5');
        if (!isMoney(o.total_price) || !(o.total_price > 0) || o.total_price >= 100000000) errors.push('total_price must be a positive amount');
        if (o.currency !== 'MAD') errors.push('currency must be MAD');
        return errors;
    }

    // Names of the fields with a problem (the UI translates them).
    function invalidFields(o) {
        var fields = [];
        validateOffer(o).forEach(function (msg) {
            var f = msg.split(' ')[0];
            if (fields.indexOf(f) === -1) fields.push(f);
        });
        return fields;
    }

    var api = { invalidFields: invalidFields, CATEGORIES: CATEGORIES, CATEGORY_LABELS: CATEGORY_LABELS, STATUSES: STATUSES, validateOffer: validateOffer, isMoney: isMoney };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) { root.GW = root.GW || {}; root.GW.schema = api; }
})(typeof window !== 'undefined' ? window : null);
