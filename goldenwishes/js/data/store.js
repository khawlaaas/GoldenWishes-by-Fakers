/* Golden Wishes — data layer. The ONLY place that knows where data comes from.
 *   'api'   (default) Postgres through our Netlify Functions (/api/*). Donations are INSERTs only:
 *           the database trigger updates amounts and statuses, this file never computes them.
 *   'local' offline fallback: the DB snapshot in seed-offers.js / seed-news.js (scripts/export-local-seed.js)
 *           + localStorage for donations, submissions and review decisions.
 * Both sources hold DB-shaped rows, mapped to front-end offers by js/data/mapping.js.
 * Reads are synchronous (from memory, loaded once at boot); writes return Promises of { ok, ... } or { ok: false, error }.
 */
window.GW = window.GW || {};

(function () {
    var DATA_SOURCE = 'api';   // switch to 'local' to run without the database
    var STORAGE_KEY = 'gw.local.v2';
    var REVIEW_CODE_KEY = 'gw.reviewCode';
    var M = GW.mapping;

    var lang = (GW.i18n && GW.i18n.lang) || 'en';
    var rows = { wishes: [], news: [] };            // raw DB-shaped rows (public wishes only)
    var mapped = { offers: [], byId: {}, news: [] };
    var donations = {};                              // offerId -> [contribution], newest first
    var status = { state: 'loading', error: null };
    var listeners = [];

    function emit() { listeners.slice().forEach(function (fn) { try { fn(); } catch (err) { console.error(err); } }); }

    function remap() {
        mapped.offers = rows.wishes.map(function (r) { return M.mapWish(r, lang); });
        mapped.byId = {};
        mapped.offers.forEach(function (o) { mapped.byId[o.id] = o; });
        mapped.news = rows.news.map(function (r) { return M.mapNews(r, lang); });
    }

    function isPublic(row) { return ['open', 'partially_funded', 'funded', 'delivered'].indexOf(row.status) !== -1; }

    function upsertRow(row) {
        var i = rows.wishes.findIndex(function (r) { return r.id === row.id; });
        if (!isPublic(row)) { if (i >= 0) rows.wishes.splice(i, 1); }
        else if (i >= 0) rows.wishes[i] = row;
        else rows.wishes.unshift(row);
        remap();
    }

    function reviewHeaders() {
        var code = '';
        try { code = sessionStorage.getItem(REVIEW_CODE_KEY) || ''; } catch (err) { /* private mode */ }
        return code ? { 'x-review-code': code } : {};
    }

    /* ------------------------------------------------------------------ */
    /* 'local' source: DB snapshot + localStorage, same rules as the DB     */
    /* ------------------------------------------------------------------ */
    var local = null;   // { contributions: [], submissions: [rows], decisions: { id: patch } }

    function localLoad() {
        try { local = Object.assign({ contributions: [], submissions: [], decisions: {} }, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
        catch (err) { local = { contributions: [], submissions: [], decisions: {} }; }
    }
    function localSave() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(local)); } catch (err) { console.warn('store: could not write localStorage', err); }
    }
    // All rows (public + pending + rejected) with local decisions and donations applied, like the DB trigger would.
    function localAllRows() {
        var all = (GW.SEED_OFFERS || []).concat(local.submissions).map(function (r) {
            return Object.assign({}, r, local.decisions[r.id] || {});
        });
        local.contributions.forEach(function (c) {
            var r = all.filter(function (x) { return x.id === c.offer_id; })[0];
            if (!r) return;
            r.amount_raised = M.round2(r.amount_raised + c.amount);
            r.status = r.amount_raised >= r.estimated_cost ? 'funded' : 'partially_funded';
        });
        return all;
    }
    function localRefresh() {
        rows.wishes = localAllRows().filter(isPublic);
        rows.news = (GW.SEED_NEWS || []).slice();
        remap();
    }

    /* ------------------------------------------------------------------ */
    /* Loading                                                             */
    /* ------------------------------------------------------------------ */
    function load() {
        if (DATA_SOURCE === 'local') {
            localLoad(); localRefresh();
            status = { state: 'ready', error: null }; emit();
            return Promise.resolve({ ok: true });
        }
        return GW.api.get('wishes', { timeoutMs: 15000 }).then(function (r) {
            if (!r.ok) { status = { state: rows.wishes.length ? 'ready' : 'error', error: r.error, code: r.code }; emit(); return r; }
            rows.wishes = r.data.wishes || []; rows.news = r.data.news || [];
            remap(); status = { state: 'ready', error: null }; emit();
            return { ok: true };
        });
    }

    /* ------------------------------------------------------------------ */
    /* Reads                                                               */
    /* ------------------------------------------------------------------ */
    function getOffers() { return mapped.offers.slice(); }
    function getOffer(id) { return mapped.byId[id] || null; }
    function getNews() { return mapped.news.slice(); }
    function remaining(offer) { return Math.max(0, M.round2(offer.total_price - offer.amount_raised)); }
    function getContributions(offerId) { return (donations[offerId] || []).slice(); }

    // Fresh copy of one wish + its recent donations (offer page).
    function refreshOffer(id) {
        if (DATA_SOURCE === 'local') {
            donations[id] = local.contributions.filter(function (c) { return c.offer_id === id; }).slice().reverse();
            emit();
            return Promise.resolve({ ok: !!getOffer(id) });
        }
        return GW.api.get('wish?id=' + encodeURIComponent(id)).then(function (r) {
            if (!r.ok) return r;
            upsertRow(r.data.wish);
            donations[id] = (r.data.donations || []).map(M.mapDonation);
            emit();
            return { ok: true };
        });
    }

    /* ------------------------------------------------------------------ */
    /* Writes                                                              */
    /* ------------------------------------------------------------------ */
    // donor: { name, email?, phone?, message? } or a plain name string.
    function contribute(offerId, amount, donor) {
        donor = typeof donor === 'string' || !donor ? { name: donor || '' } : donor;
        var amt = M.round2(amount);
        var offer = getOffer(offerId);
        if (!offer) return Promise.resolve({ ok: false, code: 'not_found' });
        if (!(amt > 0)) return Promise.resolve({ ok: false, code: 'amount_zero' });

        if (DATA_SOURCE === 'local') {
            if (offer.status !== 'open') return Promise.resolve({ ok: false, code: 'not_open' });
            var left = remaining(offer);
            if (amt > left) return Promise.resolve({ ok: false, code: 'exceeds_remaining', left: left });
            var c = { id: 'local_' + Date.now().toString(36), offer_id: offerId, amount: amt, donor_name: (donor.name || '').trim().slice(0, 100) || 'Anonymous', created_at: new Date().toISOString() };
            local.contributions.push(c); localSave(); localRefresh();
            donations[offerId] = [c].concat(donations[offerId] || []);
            emit();
            return Promise.resolve({ ok: true, contribution: c, offer: getOffer(offerId) });
        }

        return GW.api.post('donate', { wishId: offerId, amount: amt, donorName: donor.name || '', email: donor.email || '', phone: donor.phone || '', message: donor.message || '' })
            .then(function (r) {
                // The server sends back the wish as the trigger left it, success or not.
                var wishRow = r.ok ? r.data.wish : r.data && r.data.wish;
                if (wishRow) upsertRow(wishRow);
                if (!r.ok) { emit(); return { ok: false, error: r.error, code: r.code, left: r.data && r.data.left }; }
                var contribution = M.mapDonation(r.data.donation);
                donations[offerId] = [contribution].concat(donations[offerId] || []).slice(0, 8);
                emit();
                return { ok: true, contribution: contribution, offer: getOffer(offerId) };
            });
    }

    // offer: front-end draft; meta: { raw_text, trust, submitted_by }
    function addPendingOffer(offer, meta) {
        meta = meta || {};
        if (DATA_SOURCE === 'local') {
            var row = {
                id: 'local-' + Date.now().toString(36), title: offer.title, description: offer.description, story_context: offer.backstory,
                category: offer.category, urgency: M.urgencyToEnum(offer.urgency), status: 'pending_review',
                estimated_cost: M.round2(offer.total_price), amount_raised: 0, currency: 'MAD',
                city: offer.city, region: offer.region, country: 'Morocco', country_code: 'MA',
                relay_point: 'Relay point — to be assigned', tags: offer.tags || [], translations: {},
                trust_score: meta.trust ? meta.trust.score : null, trust_reasons: meta.trust ? meta.trust.reasons : [],
                submission_source: 'ai_intake', review_note: meta.submitted_by ? 'Submitted by: ' + meta.submitted_by : null,
                created_at: new Date().toISOString(), organization_name: 'Independent submissions (to be assigned)', organization_verified: false
            };
            local.submissions.push(row); localSave();
            return Promise.resolve({ ok: true, id: row.id });
        }
        return GW.api.post('submit-wish', { offer: offer, trust: meta.trust || null, raw_text: meta.raw_text || '', submitted_by: meta.submitted_by || '' })
            .then(function (r) { return r.ok ? { ok: true, id: r.data.id } : r; });
    }

    // Review queue (reviewers): { ok, pending: [offers], recent: [offers] }
    function loadReviewQueue() {
        if (DATA_SOURCE === 'local') {
            var all = localAllRows();
            var pending = all.filter(function (r) { return r.status === 'pending_review'; });
            var recent = all.filter(function (r) { return r.reviewed_at; });
            return Promise.resolve({ ok: true, pending: pending.map(function (r) { return M.mapWish(r, lang); }), recent: recent.map(function (r) { return M.mapWish(r, lang); }) });
        }
        return GW.api.get('review-queue', { headers: reviewHeaders() }).then(function (r) {
            if (!r.ok) return { ok: false, error: r.error, status: r.status, code: r.code };
            return {
                ok: true,
                pending: r.data.pending.map(function (x) { return M.mapWish(x, lang); }),
                recent: r.data.recent.map(function (x) { return M.mapWish(x, lang); })
            };
        });
    }

    // action: 'approve' | 'reject' | 'restore' | 'trust' (with trust = { score, reasons })
    function review(id, action, trust) {
        if (DATA_SOURCE === 'local') {
            var patch = action === 'approve' ? { status: 'open', reviewed_at: new Date().toISOString() }
                : action === 'reject' ? { status: 'rejected', reviewed_at: new Date().toISOString() }
                : action === 'restore' ? { status: 'pending_review', reviewed_at: null }
                : { trust_score: trust.score, trust_reasons: trust.reasons };
            local.decisions[id] = Object.assign({}, local.decisions[id] || {}, patch);
            localSave(); localRefresh(); emit();
            return Promise.resolve({ ok: true });
        }
        return GW.api.post('review', { id: id, action: action, trust: trust || null }, { headers: reviewHeaders() }).then(function (r) {
            if (!r.ok) return r;
            if (action !== 'approve') return { ok: true };
            // A newly approved wish, one NVIDIA call per step: embed it for the chat assistant,
            // translate it into French then Arabic, then reload the public list. Failures here are not fatal
            // (scripts/translate-content.js catches up on missing translations).
            var h = { headers: reviewHeaders(), timeoutMs: 15000 };
            var steps = { embedded: false, fr: false, ar: false };
            return GW.api.post('embed-wish', { id: id }, h)
                .then(function (r1) { steps.embedded = r1.ok; return GW.api.post('translate-wish', { id: id, lang: 'fr' }, h); })
                .then(function (r2) { steps.fr = r2.ok; return GW.api.post('translate-wish', { id: id, lang: 'ar' }, h); })
                .then(function (r3) {
                    steps.ar = r3.ok;
                    if (!steps.embedded || !steps.fr || !steps.ar) console.warn('approval follow-up steps:', steps);
                    GW.match && GW.match.reloadExtra && GW.match.reloadExtra();
                    return load().then(function () { return Object.assign({ ok: true }, steps); });
                });
        });
    }

    // "Reset demo data": removes every donation made through the site (is_demo) and gives the amounts back.
    function reset() {
        if (DATA_SOURCE === 'local') {
            localStorage.removeItem(STORAGE_KEY); localLoad(); localRefresh(); donations = {}; emit();
            return Promise.resolve({ ok: true, removed: null });
        }
        return GW.api.post('reset-demo', {}, { headers: reviewHeaders() }).then(function (r) {
            if (!r.ok) return r;
            donations = {};
            return load().then(function () { return { ok: true, removed: r.data.removed }; });
        });
    }

    // Volunteer / partner forms. kind: 'volunteer' | 'partner'
    function submitForm(kind, data) {
        if (DATA_SOURCE === 'local') { console.info('local mode: form not sent', kind); return Promise.resolve({ ok: true }); }
        return GW.api.post('forms', { kind: kind, data: data });
    }

    function setReviewCode(code) {
        try { if (code) sessionStorage.setItem(REVIEW_CODE_KEY, code); else sessionStorage.removeItem(REVIEW_CODE_KEY); } catch (err) { /* ignore */ }
    }

    function setLang(l) { lang = l || 'en'; remap(); emit(); }

    function subscribe(fn) {
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    }

    GW.store = {
        DATA_SOURCE: DATA_SOURCE,
        status: function () { return status; },
        load: load,
        getOffers: getOffers, getOffer: getOffer, getNews: getNews, remaining: remaining,
        getContributions: getContributions, refreshOffer: refreshOffer,
        contribute: contribute, addPendingOffer: addPendingOffer,
        loadReviewQueue: loadReviewQueue, review: review, reset: reset, setReviewCode: setReviewCode,
        submitForm: submitForm, setLang: setLang, subscribe: subscribe
    };
    GW.store.ready = load();

    // React hook: re-render the calling component whenever the store changes.
    GW.useStore = function () {
        var s = React.useState(0); var setTick = s[1];
        React.useEffect(function () {
            return GW.store.subscribe(function () { setTick(function (t) { return t + 1; }); });
        }, []);
        return GW.store;
    };
})();
