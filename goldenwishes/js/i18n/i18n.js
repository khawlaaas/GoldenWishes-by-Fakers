/* Golden Wishes — translations (English, French, Arabic).
 * Dictionaries: js/i18n/en.js, fr.js, ar.js (flat "section.key" -> string). Load them BEFORE this file.
 *   t('fund.thanks', { amount: '50 MAD' })   -> string, {placeholders} replaced
 *   t('list.count', { n: 3 })                 -> picks 'list.count.one' / '.other' / Arabic '.few', '.many'... by Intl.PluralRules
 *   tx('offer.stillNeeded', { amount: e('strong', null, '50 MAD') }) -> array of React children (elements allowed)
 * The choice is remembered in localStorage ("gw.lang"); default from the browser language.
 * Arabic sets <html dir="rtl">. Numbers, amounts and dates use Intl with Moroccan locales (Latin digits).
 * Also loaded by Node (createT) so the server can translate trust reasons and canned answers.
 */
(function (root) {
    var LANGS = ['en', 'fr', 'ar'];
    var LOCALES = { en: 'en-MA', fr: 'fr-MA', ar: 'ar-MA' };

    function createT(dicts, lang) {
        var dict = dicts[lang] || {}, fallback = dicts.en || {};
        var plural = typeof Intl !== 'undefined' && Intl.PluralRules ? new Intl.PluralRules(LOCALES[lang] || 'en') : null;
        function lookup(key, vars) {
            if (vars && typeof vars.n === 'number') {
                var form = plural ? plural.select(vars.n) : (vars.n === 1 ? 'one' : 'other');
                if (vars.n === 0 && (key + '.zero') in dict) form = 'zero';
                var k = key + '.' + form;
                if (k in dict) return dict[k];
                if ((key + '.other') in dict) return dict[key + '.other'];
                if (k in fallback) return fallback[k];
                if ((key + '.other') in fallback) return fallback[key + '.other'];
            }
            if (key in dict) return dict[key];
            if (key in fallback) return fallback[key];
            return key;
        }
        function t(key, vars) {
            var s = lookup(key, vars);
            if (typeof s !== 'string' || !vars) return s;
            return s.replace(/\{(\w+)\}/g, function (m, name) { return name in vars ? String(vars[name]) : m; });
        }
        // Same as t(), but placeholder values may be React elements: returns an array of children.
        function tx(key, vars) {
            var s = lookup(key, vars);
            if (typeof s !== 'string') return [s];
            var out = [];
            s.split(/(\{\w+\})/).forEach(function (part, i) {
                var m = part.match(/^\{(\w+)\}$/);
                if (m && vars && m[1] in vars) {
                    var v = vars[m[1]];
                    out.push(v && typeof v === 'object' && root && root.React ? root.React.cloneElement(v, { key: 'v' + i }) : String(v));
                } else if (part) out.push(part);
            });
            return out;
        }
        function fmtNumber(n) {
            var v = Math.round(Number(n || 0) * 100) / 100;
            var frac = Number.isInteger(v) ? 0 : 2;
            try { return new Intl.NumberFormat(LOCALES[lang] || 'en', { minimumFractionDigits: frac, maximumFractionDigits: frac }).format(v); }
            catch (err) { return String(v); }
        }
        function fmtMoney(n) { return fmtNumber(n) + ' ' + t('money.unit'); }
        function fmtDate(iso) {
            if (!iso) return '';
            var d = new Date(String(iso).length === 10 ? iso + 'T12:00:00Z' : iso);
            if (isNaN(d)) return String(iso);
            try { return new Intl.DateTimeFormat(LOCALES[lang] || 'en', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
            catch (err) { return String(iso).slice(0, 10); }
        }
        return { t: t, tx: tx, fmtNumber: fmtNumber, fmtMoney: fmtMoney, fmtDate: fmtDate, lang: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' };
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { createT: createT, LANGS: LANGS, LOCALES: LOCALES };
    if (!root || !root.document) return;

    /* ---------------- Browser ---------------- */
    var GW = root.GW = root.GW || {};
    var DICTS = GW.I18N || {};
    var listeners = [];

    function initialLang() {
        try { var saved = root.localStorage.getItem('gw.lang'); if (LANGS.indexOf(saved) !== -1) return saved; } catch (err) { /* private mode */ }
        var prefs = (root.navigator.languages || [root.navigator.language || 'en']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
        for (var i = 0; i < prefs.length; i++) if (LANGS.indexOf(prefs[i]) !== -1) return prefs[i];
        return 'en';
    }

    var current = null;
    function apply(lang) {
        current = createT(DICTS, lang);
        var html = root.document.documentElement;
        html.setAttribute('lang', lang);
        html.setAttribute('dir', current.dir);
        root.document.title = current.t('meta.title');
        GW.i18n.lang = lang; GW.i18n.dir = current.dir;
    }

    function setLang(lang) {
        if (LANGS.indexOf(lang) === -1 || (current && current.lang === lang)) return;
        try { root.localStorage.setItem('gw.lang', lang); } catch (err) { /* ignore */ }
        apply(lang);
        if (GW.store) GW.store.setLang(lang);
        listeners.slice().forEach(function (fn) { try { fn(lang); } catch (err) { console.error(err); } });
    }

    GW.i18n = {
        LANGS: LANGS, LOCALES: LOCALES, setLang: setLang,
        subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
        fmtNumber: function (n) { return current.fmtNumber(n); },
        fmtMoney: function (n) { return current.fmtMoney(n); },
        fmtDate: function (d) { return current.fmtDate(d); }
    };
    apply(initialLang());

    // Globals used by every view (like `e` for React.createElement).
    root.t = function (key, vars) { return current.t(key, vars); };
    root.tx = function (key, vars) { return current.tx(key, vars); };

    // React hook: re-render when the language changes.
    GW.useLang = function () {
        var s = root.React.useState(GW.i18n.lang); var setL = s[1];
        root.React.useEffect(function () { return GW.i18n.subscribe(setL); }, []);
        return GW.i18n.lang;
    };
})(typeof window !== 'undefined' ? window : null);
