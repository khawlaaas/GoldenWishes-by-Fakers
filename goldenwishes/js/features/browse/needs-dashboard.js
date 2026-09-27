/* Golden Wishes — needs map #/needs (feature 2): what is still missing, and where.
 * All sums are computed in JS from the store. Every row links to the filtered wishes list.
 * Layout: a ledger of four figures, then two ranked tables (one hue, value printed on every row).
 */
window.GW = window.GW || {};

(function () {
    function groupRemaining(offers, keyFn) {
        var groups = {};
        offers.forEach(function (o) {
            var k = keyFn(o);
            if (!groups[k]) groups[k] = { value: 0, count: 0, urgent: 0, sample: o };
            groups[k].value += GW.store.remaining(o);
            groups[k].count += 1;
            if (o.urgency >= 4) groups[k].urgent += 1;
        });
        return Object.keys(groups).map(function (k) { return Object.assign({ key: k }, groups[k]); })
            .sort(function (a, b) { return b.value - a.value; });
    }

    function RankedTable(props) {
        var max = props.rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0) || 1;
        return e('section', { className: 'mb-20', 'aria-labelledby': props.id },
            e(Eyebrow, { n: props.n }, props.subtitle),
            e('h2', { id: props.id, className: 't-h2 font-display mb-8' }, props.title),
            e('ol', { className: 'border-b', style: { borderColor: C.line } },
                props.rows.map(function (r, i) {
                    return e('li', { key: r.key, 'data-reveal': '' },
                        e('a', {
                            href: r.href, title: t('needs.rowTitle', { label: r.label, amount: formatMAD(r.value) }),
                            className: 'row-hover grid grid-cols-[2rem_1fr_auto] md:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_9rem_1.5rem] gap-x-4 gap-y-2 items-center border-t py-5 md:px-2 min-h-[44px]',
                            style: { borderColor: C.line }
                        },
                            e('span', { className: 'font-mono2 num text-[13px]', style: { color: C.inkSoft } }, String(i + 1).padStart(2, '0')),
                            e('span', { className: 'min-w-0' },
                                e('span', { className: 'flex items-center gap-2 font-display text-[20px] leading-snug', style: { color: C.ink } },
                                    r.icon ? e(Icon, { name: r.icon, size: 16, style: { color: r.color || C.inkSoft } }) : null, r.label),
                                e('span', { className: 'block text-[14px] mt-1', style: { color: C.inkSoft } }, r.sub)),
                            e('span', { className: 'col-span-3 col-start-2 md:col-span-1 md:col-start-auto order-last md:order-none' },
                                e(ProgressBar, { raised: r.value, total: max, color: C.purple, showLabel: false, plain: true })),
                            e('span', { className: 'font-mono2 num text-[16px] text-end whitespace-nowrap', style: { color: C.ink } }, formatMAD(Math.round(r.value))),
                            e(Icon, { name: 'arrowRight', size: 16, className: 'hidden md:block', style: { color: C.inkSoft } }))
                    );
                })
            )
        );
    }

    GW.NeedsPage = function NeedsPage() {
        var store = GW.useStore();
        var ref = React.useRef(null);
        var all = store.getOffers();
        var open = all.filter(function (o) { return o.status === 'open'; });
        var funded = all.filter(function (o) { return o.status === 'funded'; });
        var needed = open.reduce(function (s, o) { return s + store.remaining(o); }, 0);
        var urgent = open.filter(function (o) { return o.urgency >= 4; }).length;
        GW.motion.useReveal(ref, [GW.i18n.lang]);

        function sub(g) { return t('needs.count', { n: g.count }) + (g.urgent ? ' ' + t('needs.urgentNote', { n: g.urgent }) : ''); }

        var byRegion = groupRemaining(open, function (o) { return o.country_code + '|' + o.region; }).map(function (g) {
            var o = g.sample;
            return { key: g.key, label: regionLabel(o.region), value: g.value, sub: sub(g), icon: 'mapPin',
                href: GW.router.buildHash('/', { country: o.country_code, region: o.region }) };
        });
        var byCategory = groupRemaining(open, function (o) { return o.category; }).map(function (g) {
            var meta = CATEGORY_META[g.key] || {};
            return { key: g.key, label: categoryLabel(g.key), value: g.value, sub: sub(g), icon: meta.icon, color: meta.color,
                href: GW.router.buildHash('/', { category: g.key }) };
        });

        function Figure(p) {
            return e('div', { 'data-reveal': '', className: 'py-6 md:py-0 md:px-6 first:md:ps-0 border-t md:border-t-0 md:border-s first:border-t-0 first:md:border-s-0', style: { borderColor: C.line } },
                e('div', { className: 'font-display text-[40px] md:text-[48px] leading-none', style: { color: p.color || C.ink } }, e(GW.CountUp, { value: p.value, format: p.format })),
                e('div', { className: 't-eyebrow mt-3', style: { color: C.inkSoft } }, p.label));
        }

        return e('section', { className: 'wrap py-12 md:py-20', ref: ref },
            e(SectionHead, { as: 'h1', eyebrow: t('nav.needs'), title: t('needs.title'), lede: t('needs.sub') }),
            e('div', { className: 'grid md:grid-cols-[1.5fr_1fr_1fr_1fr] border-y py-8 mb-20', style: { borderColor: C.ink } },
                e(Figure, { value: needed, format: function (v) { return formatMAD(Math.round(v)); }, label: t('needs.stillNeeded'), color: C.purple }),
                e(Figure, { value: open.length, label: t('needs.openWishes') }),
                e(Figure, { value: urgent, label: t('needs.urgent'), color: C.pinkText }),
                e(Figure, { value: funded.length, label: t('needs.funded'), color: C.goldText })),
            e(RankedTable, { id: 'by-region', n: '01', title: t('needs.byRegion'), subtitle: t('needs.byRegionSub'), rows: byRegion }),
            e(RankedTable, { id: 'by-cat', n: '02', title: t('needs.byCat'), subtitle: t('needs.byCatSub'), rows: byCategory })
        );
    };
})();
