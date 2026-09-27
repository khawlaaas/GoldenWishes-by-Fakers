/* Golden Wishes — deterministic trust rules (feature 7). No AI needed; the AI only adds a second opinion.
 * Loaded in the browser (GW.trustRules) and by Node (/api/trust-check, /api/intake).
 * checkRules(offer, referenceOffers, tr?) -> { score 0-100, flags: [{ reason, weight }] }
 * tr(key, vars) translates the reasons (js/i18n); in the browser it defaults to the global t().
 */
(function (root) {
    var PHONE = /(\+?212|\b0)[\s.-]?[5-7](?:[\s.-]?\d{2}){4}\b|\b\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}\b/;
    var EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
    var PAYMENT = /\b(rib|iban|cash\s?plus|cashplus|wafacash|western union|moneygram|paypal|send (me )?(the )?money|pay me|directly to me|envoyez.*(argent|directement)|virement direct|sift liya|b3at liya)\b/i;
    var PRESSURE = /\b(urgent|urgently|asap|today|tonight|right now|immediately|immédiatement|aujourd'hui|ce soir|daba|db|tout de suite|before tonight)\b/gi;
    var LUXURY = /\b(iphone|ipad|macbook|playstation|ps5|xbox|gaming|rolex|gold|car|voiture|motorbike|moto|jewel|bijou)\b/i;
    var FULL_NAME = /^[A-Z][a-z]+\s+[A-Z][a-z]+/;

    function median(nums) {
        if (!nums.length) return null;
        var s = nums.slice().sort(function (a, b) { return a - b; });
        var m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function translator(tr) {
        if (tr) return tr;
        if (root && root.t) return root.t;
        return function (key) { return key; };
    }

    function checkRules(offer, referenceOffers, tr) {
        var T = translator(tr);
        var flags = [];
        function flag(weight, key, vars) { flags.push({ weight: weight, key: key, reason: T(key, vars) }); }
        var text = [offer.title, offer.description, offer.backstory].join(' \n ');

        // 1. Price vs. typical price for the category (from verified offers).
        var refs = (referenceOffers || []).filter(function (o) { return o.verified_by && o.category === offer.category && o.id !== offer.id; });
        var med = median(refs.map(function (o) { return o.total_price; }));
        if (med && offer.total_price > 0) {
            var ratio = offer.total_price / med;
            var cat = T('cat.' + offer.category);
            if (ratio >= 5) flag(-35, 'trust.price5', { ratio: Math.round(ratio), cat: cat, median: Math.round(med) });
            else if (ratio >= 2.5) flag(-15, 'trust.price25', { cat: cat, median: Math.round(med) });
        }
        if (!(offer.total_price > 0)) flag(-20, 'trust.noPrice');

        // 2. Contact details and payment outside the platform.
        if (PHONE.test(text)) flag(-25, 'trust.phone');
        if (EMAIL.test(text)) flag(-20, 'trust.email');
        if (PAYMENT.test(text)) flag(-30, 'trust.payment');

        // 3. Pressure and luxury.
        var pressure = (text.match(PRESSURE) || []).length;
        if (pressure >= 2) flag(-10, 'trust.pressure');
        if (LUXURY.test(text)) flag(-20, 'trust.luxury');

        // 4. Privacy and detail.
        if (FULL_NAME.test(offer.beneficiary_alias || '') || /\b(my name is|je m'appelle|smiti)\b/i.test(text)) {
            flag(-15, 'trust.fullName');
        }
        if (String(offer.backstory || '').length < 120 || String(offer.description || '').length < 25) {
            flag(-15, 'trust.short');
        }
        if (!offer.verified_by) flag(-5, 'trust.unverified');

        var score = 100;
        flags.forEach(function (f) { score += f.weight; });
        return { score: Math.max(0, Math.min(100, score)), flags: flags };
    }

    function level(score, tr) {
        var T = translator(tr);
        if (score >= 75) return { key: 'low', label: T('trust.low'), color: '#4E6643' };
        if (score >= 45) return { key: 'medium', label: T('trust.medium'), color: '#8A6414' };
        return { key: 'high', label: T('trust.high'), color: '#B03A3A' };
    }

    var api = { checkRules: checkRules, level: level };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) { root.GW = root.GW || {}; root.GW.trustRules = api; }
})(typeof window !== 'undefined' ? window : null);
