/* Golden Wishes — semantic matching for the chatbot (feature 6).
 * Primary: cosine similarity between the donor's query embedding (NVIDIA, via /api/embed) and the
 * precomputed offer embeddings in js/data/offer-embeddings.json.
 * Fallback: TF-IDF over offer text (no network), used per offer when a vector is missing or stale.
 */
window.GW = window.GW || {};

(function () {
    var embeddings = null;      // { model, dim, offers: { id: { hash, v } } }
    var loading = null;

    // The text that was embedded: rag_text, built by the database trigger (English, always up to date).
    function offerText(o) {
        return o.rag_text || [o.title, o.description, o.category, (o.tags || []).join(', '), o.city + ', ' + o.region + ', ' + o.country, o.backstory].join('. ');
    }
    var textHash = GW.mapping.textHash;

    // Static cache (scripts/embed-offers.js) + vectors of wishes approved later (/api/embeddings-extra).
    function loadEmbeddings() {
        if (embeddings) return Promise.resolve(embeddings);
        if (!loading) {
            loading = Promise.all([
                fetch('js/data/offer-embeddings.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
                GW.api.get('embeddings-extra', { timeoutMs: 8000 })
            ]).then(function (res) {
                var d = res[0] || { offers: {} };
                if (res[1].ok) Object.keys(res[1].data.offers || {}).forEach(function (id) { d.offers[id] = res[1].data.offers[id]; });
                embeddings = d; return d;
            }).catch(function () { loading = null; return null; });
        }
        return loading;
    }
    function reloadExtra() { embeddings = null; loading = null; }

    function cosine(a, b) {
        var dot = 0, na = 0, nb = 0;
        for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
        return na && nb ? dot / Math.sqrt(na * nb) : 0;
    }

    /* ---- TF-IDF fallback ---- */
    var STOP = 'a an the and or of to for in on with is are be it this that my our your i we you he she they his her their from at by as de la le les des du un une et pour avec en au aux'.split(' ');
    function tokenize(text) {
        return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .split(/[^a-z0-9؀-ۿ]+/).filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1; })
            .map(function (w) { return w.length > 4 ? w.replace(/(ies|es|s)$/, '') : w; });
    }
    function tfidfScores(query, offers) {
        var docs = offers.map(function (o) { return tokenize(offerText(o)); });
        var df = {};
        docs.forEach(function (d) { Object.keys(d.reduce(function (s, w) { s[w] = 1; return s; }, {})).forEach(function (w) { df[w] = (df[w] || 0) + 1; }); });
        var N = docs.length;
        function vec(tokens) {
            var tf = {}; tokens.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
            var v = {}; Object.keys(tf).forEach(function (w) { v[w] = tf[w] * Math.log(1 + N / (1 + (df[w] || 0))); });
            return v;
        }
        function cos(a, b) {
            var dot = 0, na = 0, nb = 0;
            Object.keys(a).forEach(function (w) { na += a[w] * a[w]; if (b[w]) dot += a[w] * b[w]; });
            Object.keys(b).forEach(function (w) { nb += b[w] * b[w]; });
            return na && nb ? dot / Math.sqrt(na * nb) : 0;
        }
        var q = vec(tokenize(query));
        return docs.map(function (d) { return cos(q, vec(d)); });
    }

    /* Rank open offers for a parsed request.
     * parsed: { categories, country_code, region, query_en }, queryVector: number[] | null
     * Returns [{ offer, score, semantic, method }] best first.
     */
    function rank(offers, parsed, queryVector) {
        var open = offers.filter(function (o) { return o.status === 'open' && o.total_price - o.amount_raised > 0; });
        var cats = parsed.categories || [];
        // Narrow to the requested place, then category, when such offers exist.
        // A named place wins over a category (the donor chose where to help).
        var pool = open;
        if (parsed.region || parsed.country_code) {
            var byPlace = pool.filter(function (o) { return parsed.region ? o.region === parsed.region : o.country_code === parsed.country_code; });
            if (byPlace.length) pool = byPlace;
        }
        if (cats.length) {
            var byCat = pool.filter(function (o) { return cats.indexOf(o.category) !== -1; });
            if (byCat.length) pool = byCat;
        }
        var query = parsed.query_en || '';
        var tfidf = tfidfScores(query + ' ' + cats.join(' ').replace(/_/g, ' '), pool);
        return pool.map(function (o, i) {
            var stored = embeddings && embeddings.offers && embeddings.offers[o.id];
            var useVector = queryVector && stored && stored.hash === textHash(offerText(o)) && stored.v.length === queryVector.length;
            var semantic = useVector ? cosine(queryVector, stored.v) : tfidf[i];
            var score = semantic
                + (cats.indexOf(o.category) !== -1 ? 0.2 : 0)
                + (parsed.region && o.region === parsed.region ? 0.1 : 0)
                + 0.03 * (o.urgency || 1);
            return { offer: o, score: score, semantic: semantic, method: useVector ? 'embedding' : 'tfidf' };
        }).sort(function (a, b) { return b.score - a.score; });
    }

    GW.match = { loadEmbeddings: loadEmbeddings, reloadExtra: reloadExtra, rank: rank, offerText: offerText, textHash: textHash };
})();
