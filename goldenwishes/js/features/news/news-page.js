/* Golden Wishes — News tab #/news (feature 5). Newspaper layout: the most severe item leads, the others follow
 * in two ruled columns. Each item links to the wishes of its region. Every item is labeled "Sample data".
 */
window.GW = window.GW || {};

(function () {
    function SampleBadge() {
        return e('span', { className: 't-eyebrow px-2 py-0.5 border', style: { color: C.goldText, borderColor: C.goldText } }, t('news.sample'));
    }

    function severityColor(s) { return s >= 5 ? '#B03A3A' : s >= 4 ? C.pinkText : s >= 3 ? C.goldText : C.inkSoft; }

    // Everything a news item needs to know about its region.
    function regionFacts(n, offers) {
        var open = offers.filter(function (o) { return o.status === 'open' && o.country_code === n.country_code && o.region === n.region; });
        var relevant = open.filter(function (o) { return n.needed_categories.indexOf(o.category) !== -1; });
        var cats = n.needed_categories.filter(function (c) { return relevant.some(function (o) { return o.category === c; }); });
        var query = { country: n.country_code, region: n.region };
        if (cats.length === 1) query.category = cats[0];
        return { open: open, needed: open.reduce(function (s, o) { return s + GW.store.remaining(o); }, 0), query: query };
    }

    function Dateline(props) {
        var n = props.item;
        return e('div', { className: 'flex flex-wrap items-center gap-x-3 gap-y-2 mb-4' },
            e(SampleBadge),
            e('span', { className: 't-eyebrow', style: { color: C.ink } }, regionLabel(n.region) + ' — ' + GW.i18n.fmtDate(n.date)),
            e('span', { className: 't-eyebrow', style: { color: severityColor(n.severity) } }, t('severity.' + n.severity) + ' · ' + n.severity + '/5'));
    }

    function Actions(props) {
        var n = props.item, f = props.facts;
        return e('div', { className: 'flex flex-wrap gap-3' },
            f.open.length ? e('a', {
                href: GW.router.buildHash('/', f.query),
                className: 'inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-md font-semibold text-[15px] press',
                style: { backgroundColor: C.purple, color: '#fff' }
            }, t('news.help'), e(Icon, { name: 'arrowRight', size: 15 })) : null,
            e(GhostButton, {
                onClick: function () { window.dispatchEvent(new CustomEvent('gw:open-chat', { detail: { message: t('news.chatPrompt', { region: regionLabel(n.region), cats: n.needed_categories.map(categoryLabel).join(', ') }) } })); }
            }, e(Icon, { name: 'sparkles', size: 15 }), t('news.ask')));
    }

    function Categories(props) {
        return e('ul', { className: 'flex flex-wrap gap-x-4 gap-y-1 mb-5' },
            props.item.needed_categories.map(function (c) {
                var meta = CATEGORY_META[c] || { icon: 'heart', color: C.purple };
                return e('li', { key: c, className: 'inline-flex items-center gap-1.5 text-[14px] font-semibold', style: { color: meta.color } }, e(Icon, { name: meta.icon, size: 14 }), categoryLabel(c));
            }));
    }

    function RegionLine(props) {
        var f = props.facts;
        return e('p', { className: 'text-[15px] mb-5', style: { color: C.ink } },
            f.open.length
                ? e('span', null, e('strong', null, t('news.openCount', { n: f.open.length })), ' ' + t('news.inRegion', { amount: formatMAD(f.needed) }))
                : e('span', { style: { color: C.inkSoft } }, t('news.none')));
    }

    function Lead(props) {
        var n = props.item, f = regionFacts(n, props.offers);
        return e('article', { 'data-reveal': '', className: 'grid md:grid-cols-12 gap-x-10 gap-y-8 border-t-2 pt-8 pb-14', style: { borderColor: C.ink } },
            e('div', { className: 'md:col-span-8' },
                e(Dateline, { item: n }),
                e('h2', { className: 't-display md:text-[72px] mb-6', dir: 'auto' }, n.title),
                e('p', { className: 't-story max-w-[60ch] mb-6', dir: 'auto', style: { color: C.ink } }, n.summary),
                e(Categories, { item: n }),
                e(Actions, { item: n, facts: f })),
            e('div', { className: 'md:col-span-3 md:col-start-10 md:border-s md:ps-8 flex md:flex-col gap-8', style: { borderColor: C.line } },
                e('div', null,
                    e('div', { className: 'font-display text-[44px] leading-none' }, e(GW.CountUp, { value: f.open.length })),
                    e('div', { className: 't-eyebrow mt-2', style: { color: C.inkSoft } }, t('needs.openWishes'))),
                e('div', null,
                    e('div', { className: 'font-display text-[32px] leading-none', style: { color: C.purple } }, e(GW.CountUp, { value: f.needed, format: function (v) { return formatMAD(Math.round(v)); } })),
                    e('div', { className: 't-eyebrow mt-2', style: { color: C.inkSoft } }, t('needs.stillNeeded'))))
        );
    }

    function Item(props) {
        var n = props.item, f = regionFacts(n, props.offers);
        return e('article', { 'data-reveal': '', className: 'border-t pt-6 pb-10', style: { borderColor: C.ink } },
            e(Dateline, { item: n }),
            e('h3', { className: 't-h3 font-display mb-3', dir: 'auto' }, n.title),
            e('p', { className: 'text-[16px] leading-relaxed mb-4', dir: 'auto', style: { color: C.inkSoft } }, n.summary),
            e(Categories, { item: n }),
            e(RegionLine, { facts: f }),
            e(Actions, { item: n, facts: f }));
    }

    GW.NewsPage = function NewsPage() {
        var store = GW.useStore();
        var ref = React.useRef(null);
        var news = store.getNews().slice().sort(function (a, b) { return b.severity - a.severity || (a.date < b.date ? 1 : -1); });
        var offers = store.getOffers();
        GW.motion.useReveal(ref, [news.length, GW.i18n.lang]);
        return e('section', { className: 'wrap py-12 md:py-20', ref: ref },
            e(SectionHead, { as: 'h1', eyebrow: t('nav.news'), title: t('news.title'), lede: t('news.sub') }),
            e('p', { className: 'flex items-start gap-3 mb-12 text-[15px] border-s-2 ps-4 max-w-3xl', role: 'note', style: { borderColor: C.goldText, color: C.ink } },
                e(Icon, { name: 'alert', size: 18, style: { color: C.goldText, flexShrink: 0, marginTop: 2 } }),
                e('span', null, e('strong', null, t('news.disclaimerStrong') + ' '), t('news.disclaimer'))),
            news.length ? e(Lead, { item: news[0], offers: offers }) : null,
            e('div', { className: 'grid md:grid-cols-2 gap-x-12' },
                news.slice(1).map(function (n) { return e(Item, { key: n.id, item: n, offers: offers }); }))
        );
    };
})();
