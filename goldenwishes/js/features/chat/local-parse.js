/* Golden Wishes — keyword parser for the chatbot (feature 6), no AI needed.
 * Used when the NVIDIA API is unreachable, and by the server for DEMO_FALLBACK canned answers.
 * Understands a bit of Darija, French, English and Arabic.
 */
(function (root) {
    // Keys are the database categories (js/data/schema.js).
    var CATEGORY_KEYWORDS = {
        education: ['school', 'study', 'student', 'book', 'books', 'education', 'class', 'l9raya', 'qraya', 'mdrasa', 'madrasa', 'lmdrasa', 'ktob', 'ktab', 'école', 'ecole', 'scolaire', 'études', 'etudes', 'livre', 'livres', 'cartable', 'قراية', 'مدرسة', 'كتب', 'تعليم'],
        food: ['food', 'groceries', 'meal', 'hungry', 'makla', 'mekla', 'ftour', 'l9ofa', 'nourriture', 'repas', 'courses', 'manger', 'panier', 'ماكلة', 'طعام', 'قفة', 'غذاء'],
        health: ['health', 'medicine', 'medical', 'doctor', 'hospital', 'glasses', 'dwa', 'sbitar', 'tbib', 'sa7a', 'santé', 'sante', 'médicament', 'medicament', 'médecin', 'lunettes', 'صحة', 'دوا', 'سبيطار', 'دواء'],
        essentials: ['blanket', 'winter', 'warm', 'bard', 'bared', 'hygiene', 'mattress', 'water', 'couverture', 'hiver', 'froid', 'eau', 'matelas', 'برد', 'غطاء', 'فراش'],
        clothing: ['clothes', 'clothing', 'coat', 'jacket', 'shoes', 'boots', '7wayj', 'hwayj', 'kasawi', 'sabbat', 'vêtements', 'vetements', 'manteau', 'chaussures', 'حوايج', 'ملابس', 'صباط'],
        technology: ['laptop', 'computer', 'tablet', 'phone', 'internet', 'pc', 'ordinateur', 'tablette', 'informatique', 'حاسوب', 'تابليت'],
        sport: ['sport', 'football', 'ball', 'boots', 'kora', 'bicycle', 'bike', 'velo', 'vélo', 'ballon', 'كرة', 'رياضة'],
        shelter: ['roof', 'house', 'home', 'shelter', 'repair', 'rain', 'storm', 'flood', 'dar', 'sa9f', 'maison', 'toit', 'logement', 'pluie', 'tempête', 'inondation', 'دار', 'سقف', 'سكن'],
        family_care: ['baby', 'babies', 'infant', 'mother', 'mom', 'family', 'tfel', 'bébé', 'bebe', 'mère', 'mere', 'maman', 'famille', 'lait', 'رضيع', 'أم', 'عائلة'],
        creative: ['art', 'drawing', 'paint', 'music', 'guitar', 'rsm', 'dessin', 'peinture', 'musique', 'رسم', 'فن', 'موسيقى']
    };

    // Words that point at children, without a clear category.
    var CHILD_WORDS = ['drari', 'wlad', 'children', 'kids', 'child', 'enfants', 'enfant', 'gosses', 'أطفال', 'دراري'];

    // Region names exactly as stored in the database.
    var MA_REGIONS = ['Casablanca-Settat', 'Rabat-Sale-Kenitra', 'Marrakech-Safi', 'Souss-Massa', 'Fes-Meknes', 'Tanger-Tetouan-Al Hoceima',
        "L'Oriental", 'Beni Mellal-Khenifra', 'Draa-Tafilalet', 'Guelmim-Oued Noun', 'Laayoune-Sakia El Hamra', 'Dakhla-Oued Ed-Dahab'];

    var PLACES = [
        { words: ['casa', 'casablanca', 'dar lbida', 'mohammedia', 'settat', 'الدار البيضاء', 'كازا'], country_code: 'MA', region: 'Casablanca-Settat' },
        { words: ['rabat', 'sale', 'salé', 'kenitra', 'kénitra', 'temara', 'الرباط', 'سلا', 'القنيطرة'], country_code: 'MA', region: 'Rabat-Sale-Kenitra' },
        { words: ['souss', 'agadir', 'taroudant', 'tiznit', 'sous', 'سوس', 'أكادير'], country_code: 'MA', region: 'Souss-Massa' },
        { words: ['marrakech', 'marrakesh', 'mourrakech', 'safi', 'essaouira', 'مراكش'], country_code: 'MA', region: 'Marrakech-Safi' },
        { words: ['ouarzazate', 'draa', 'drâa', 'tafilalet', 'errachidia', 'zagora', 'ورزازات'], country_code: 'MA', region: 'Draa-Tafilalet' },
        { words: ['oujda', 'oriental', 'nador', 'berkane', 'وجدة', 'الناظور'], country_code: 'MA', region: "L'Oriental" },
        { words: ['fes', 'fès', 'fez', 'meknes', 'meknès', 'azrou', 'ifrane', 'فاس', 'مكناس'], country_code: 'MA', region: 'Fes-Meknes' },
        { words: ['tanger', 'tangier', 'tetouan', 'tétouan', 'hoceima', 'chefchaouen', 'طنجة', 'تطوان'], country_code: 'MA', region: 'Tanger-Tetouan-Al Hoceima' },
        { words: ['beni mellal', 'khenifra', 'بني ملال'], country_code: 'MA', region: 'Beni Mellal-Khenifra' },
        { words: ['morocco', 'maroc', 'lmghrib', 'المغرب'], country_code: 'MA', region: null }
    ];

    function normalize(text) {
        return (' ' + String(text || '').toLowerCase() + ' ').replace(/[.,;:!?()"'\n]/g, ' ');
    }

    function hasWord(t, w) {
        // Latin words must match as whole words; Arabic script matches as a substring.
        if (/[a-z]/.test(w)) return t.indexOf(' ' + w + ' ') !== -1 || (w.length > 4 && t.indexOf(w) !== -1);
        return t.indexOf(w) !== -1;
    }

    function detectLanguage(raw) {
        var t = normalize(raw);
        if (/[؀-ۿ]/.test(raw)) return 'ar';
        if (/[0-9][a-z]|[a-z][0-9]/.test(t.replace(/[0-9]+ ?(dh|mad|dhs)/g, '')) || /\b(bghit|3ndi|drari|wlad|dyal|chi|bzaf|n3awen|mzyan)\b/.test(t)) return 'darija';
        if (/\b(je|j'ai|veux|aider|pour|les|des|enfants|avec)\b/.test(t) || /é|è|à|ç/.test(t)) return 'fr';
        return 'en';
    }

    // Finds the amount the donor typed. Prefers a number next to a currency; ignores Darija digits
    // glued to letters ("3ndi", "n3awen"); understands "1,000", "1 000" and "2k".
    function parseBudget(raw) {
        var t = ' ' + String(raw || '').toLowerCase().replace(/(\d)[,\s .](\d{3})(?!\d)/g, '$1$2') + ' ';
        var re = /(\d+(?:[.,]\d+)?)(\s*k(?![a-z]))?\s*(dh|dhs|mad|dirhams?|درهم|دراهم)?/g;
        var best = null, m;
        while ((m = re.exec(t)) !== null) {
            if (!m[0].trim()) { re.lastIndex++; continue; }
            var before = t.charAt(m.index - 1);
            var after = t.charAt(m.index + m[1].length);
            if (/[a-z؀-ۿ]/.test(before)) continue;
            if (!m[2] && !m[3] && /[a-z؀-ۿ]/.test(after)) continue;
            var n = parseFloat(m[1].replace(',', '.')) * (m[2] ? 1000 : 1);
            if (!isFinite(n) || n <= 0 || n > 1000000) continue;
            var cand = { n: Math.floor(n), currency: !!m[3] };
            if (!best || (cand.currency && !best.currency) || (cand.currency === best.currency && cand.n > best.n)) best = cand;
        }
        return best ? best.n : null;
    }

    function parseLocal(message) {
        var t = normalize(message);
        var categories = [];
        Object.keys(CATEGORY_KEYWORDS).forEach(function (cat) {
            if (CATEGORY_KEYWORDS[cat].some(function (w) { return hasWord(t, w); })) categories.push(cat);
        });
        var mentionsChildren = CHILD_WORDS.some(function (w) { return hasWord(t, w); });
        var place = null;
        PLACES.some(function (p) {
            if (p.words.some(function (w) { return hasWord(t, w); })) { place = p; return true; }
            return false;
        });
        var english = categories.join(' ').replace(/_/g, ' ') + (mentionsChildren ? ' children' : '') + (place && place.region ? ' ' + place.region : '');
        return {
            budget: parseBudget(message),
            categories: categories,
            country_code: place ? place.country_code : null,
            region: place ? place.region : null,
            query_en: (english.trim() || String(message || '')).slice(0, 300),
            language: detectLanguage(message),
            source: 'keywords'
        };
    }

    var api = { parseLocal: parseLocal, detectLanguage: detectLanguage, parseBudget: parseBudget, PLACES: PLACES, MA_REGIONS: MA_REGIONS, CATEGORY_KEYWORDS: CATEGORY_KEYWORDS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) { root.GW = root.GW || {}; root.GW.localParse = api; }
})(typeof window !== 'undefined' ? window : null);
