/* Golden Wishes — mapping between database rows and the front-end shapes (Offer, NewsItem, Contribution).
 * The API returns DB-shaped rows (see netlify/lib/wishes.js); the local seed files hold the same rows,
 * so both data sources go through these functions. Loaded in the browser (GW.mapping) and by Node.
 */
(function (root) {
    // DB urgency enum <-> our 1-5 display (5 = most urgent; "urgent only" = 4-5 = high + critical).
    var URGENCY_TO_NUM = { low: 1, medium: 3, high: 4, critical: 5 };
    function urgencyToEnum(n) {
        n = Number(n) || 3;
        return n >= 5 ? 'critical' : n >= 4 ? 'high' : n >= 3 ? 'medium' : 'low';
    }

    // DB wish_status -> front status. partially_funded is still open to donations.
    var STATUS = { open: 'open', partially_funded: 'open', funded: 'funded', delivered: 'funded', pending_review: 'pending_review', rejected: 'rejected', expired: 'expired' };

    function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }

    // Translated field if present, otherwise the original (English) column.
    function tr(row, lang, field, fallback) {
        var t = row.translations && lang && lang !== 'en' ? row.translations[lang] : null;
        return (t && typeof t[field] === 'string' && t[field].trim()) ? t[field] : fallback;
    }

    function alias(row) {
        if (!row.nickname) return 'Anonymous';
        return row.age !== null && row.age !== undefined ? row.nickname + ', ' + row.age : row.nickname;
    }

    function mapWish(row, lang) {
        return {
            id: row.id,
            title: tr(row, lang, 'title', row.title),
            description: tr(row, lang, 'description', row.description),
            backstory: tr(row, lang, 'story_context', row.story_context || ''),
            beneficiary_alias: alias(row),
            category: row.category,
            tags: (row.tags || []).slice(),
            country: row.country, country_code: row.country_code, region: row.region, city: row.city,
            urgency: URGENCY_TO_NUM[row.urgency] || 3,
            total_price: round2(row.estimated_cost),
            currency: row.currency || 'MAD',
            amount_raised: round2(row.amount_raised),
            status: STATUS[row.status] || row.status,
            db_status: row.status,
            verified_by: row.organization_verified ? row.organization_name : null,
            organization_name: row.organization_name || null,
            trust: row.trust_score !== null && row.trust_score !== undefined ? { score: row.trust_score, reasons: row.trust_reasons || [] } : null,
            relay_point: row.relay_point || null,
            rag_text: row.rag_text || null,
            submission_source: row.submission_source || null,
            review_note: row.review_note || null,
            image_url: null,
            created_at: row.created_at,
            reviewed_at: row.reviewed_at || null
        };
    }

    function mapNews(row, lang) {
        return {
            id: row.id,
            title: tr(row, lang, 'title', row.title),
            summary: tr(row, lang, 'summary', row.summary),
            country: row.country, country_code: row.country_code, region: row.region,
            date: row.published_on,
            severity: row.severity,
            needed_categories: (row.needed_categories || []).slice(),
            is_mock: row.is_mock !== false
        };
    }

    function mapDonation(row) {
        return { id: row.id, offer_id: row.wish_id, amount: round2(row.amount), donor_name: row.donor_display_name || 'Anonymous', created_at: row.donated_at };
    }

    // Short hash of the text an embedding was computed from (detects stale vectors).
    function textHash(text) {
        var h = 5381;
        text = String(text || '');
        for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
        return h.toString(36);
    }

    var api = { textHash: textHash, mapWish: mapWish, mapNews: mapNews, mapDonation: mapDonation, urgencyToEnum: urgencyToEnum, URGENCY_TO_NUM: URGENCY_TO_NUM, round2: round2 };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) { root.GW = root.GW || {}; root.GW.mapping = api; }
})(typeof window !== 'undefined' ? window : null);
