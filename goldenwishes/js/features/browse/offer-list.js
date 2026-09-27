/* Golden Wishes — the wishes index (features 2 + 3). Filters live in the URL: #/?category=education
 * Layout: the most urgent matching wish is featured with its story, the others are index rows,
 * each with its wish mark and a visible Fund action (works on touch). Fulfilled wishes come last, quieter.
 */
window.GW = window.GW || {};

(function () {
    function excerpt(text, max) {
        text = String(text || '');
        if (text.length <= max) return text;
        var cut = text.slice(0, max);
        var end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('، '), cut.lastIndexOf('؛ '));
        return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…');
    }

    function place(o) { return cityLabel(o.city) + ', ' + regionLabel(o.region); }

    function FundLink(props) {
        var o = props.offer;
        return e('a', {
            href: '#/offer/' + o.id, 'aria-label': t('list.fundAria', { title: o.title }),
            className: 'inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[88px] px-4 rounded-md font-semibold text-[15px] press',
            style: { backgroundColor: C.purple, color: '#fff' }
        }, props.label || t('list.fund'), e(Icon, { name: 'arrowRight', size: 15 }));
    }

    function CategoryLine(props) {
        var meta = CATEGORY_META[props.offer.category] || { icon: 'heart', color: C.purple };
        return e('div', { className: 'flex flex-wrap items-center gap-x-4 gap-y-1' },
            e('span', { className: 't-eyebrow inline-flex items-center gap-1.5', style: { color: meta.color } },
                e(Icon, { name: meta.icon, size: 14 }), categoryLabel(props.offer.category)),
            props.offer.status === 'open' ? e(UrgencyBadge, { urgency: props.offer.urgency }) : null);
    }

    // The most urgent wish, with room for its story.
    function Featured(props) {
        var o = props.offer;
        var meta = CATEGORY_META[o.category] || { color: C.purple };
        var left = GW.store.remaining(o);
        return e('article', { 'data-reveal': '', className: 'grid md:grid-cols-12 gap-x-10 gap-y-8 border-t pt-8 pb-12 mb-4', style: { borderColor: C.ink } },
            e('div', { className: 'md:col-span-7' },
                e('div', { className: 't-eyebrow mb-5', style: { color: o.urgency >= 4 ? C.pinkText : C.inkSoft } }, t(o.urgency >= 4 ? 'list.featured' : 'list.featuredPlain')),
                e(CategoryLine, { offer: o }),
                e('h3', { className: 't-h2 font-display mt-4 mb-6', dir: 'auto' },
                    e('a', { href: '#/offer/' + o.id, className: 'hover:opacity-80', 'data-test': 'wish-title' }, o.title)),
                e('blockquote', { className: 't-story max-w-2xl border-s-2 ps-5', dir: 'auto', style: { borderColor: meta.color, color: C.ink } }, excerpt(o.backstory, 320)),
                e('div', { className: 'mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]', style: { color: C.inkSoft } },
                    e('span', { className: 'inline-flex items-center gap-1.5' }, e(Icon, { name: 'mapPin', size: 15 }), place(o)),
                    e('span', { className: 'inline-flex items-center gap-1.5' }, e(Icon, { name: 'users', size: 15 }), o.beneficiary_alias === 'Anonymous' ? t('offer.anonymous') : o.beneficiary_alias),
                    e('a', { href: '#/offer/' + o.id, className: 'inline-flex items-center gap-1 min-h-[44px] font-semibold link-draw', style: { color: C.purple } }, t('list.readStory'), e(Icon, { name: 'arrowRight', size: 15 })))
            ),
            e('div', { className: 'md:col-span-4 md:col-start-9 md:border-s md:ps-10 flex flex-col justify-end', style: { borderColor: C.line } },
                e(WishMark, { color: meta.color, size: 56 }),
                e('div', { className: 'mt-8 font-display text-[44px] leading-none num', style: { color: C.ink } }, formatMAD(left)),
                e('div', { className: 't-eyebrow mt-3 mb-5', style: { color: C.inkSoft } }, t('card.stillNeededOf', { total: formatMAD(o.total_price) })),
                e(ProgressBar, { raised: o.amount_raised, total: o.total_price, color: meta.color, className: 'mb-6' }),
                e(FundLink, { offer: o, label: t('card.fund') })
            )
        );
    }

    // One index row. Stacks on phones; the Fund action is always visible.
    function Row(props) {
        var o = props.offer;
        var meta = CATEGORY_META[o.category] || { icon: 'heart', color: C.purple };
        var funded = o.status === 'funded';
        var left = GW.store.remaining(o);
        return e('li', { 'data-reveal': '', className: 'row-hover grid grid-cols-[auto_1fr] md:grid-cols-[auto_minmax(0,1fr)_200px_150px_auto] gap-x-5 gap-y-3 items-center border-t py-6 md:px-2', style: { borderColor: C.line } },
            e(WishMark, { color: meta.color, filled: funded, size: 36 }),
            e('div', { className: 'min-w-0' },
                e(CategoryLine, { offer: o }),
                e('h3', { className: 'font-display text-[21px] leading-snug mt-2', dir: 'auto' },
                    e('a', { href: '#/offer/' + o.id, className: 'hover:opacity-80', 'data-test': 'wish-title' }, o.title)),
                e('p', { className: 'text-[15px] mt-1 line-clamp-2 max-w-xl', dir: 'auto', style: { color: C.inkSoft } }, o.description),
                e('div', { className: 'text-[14px] mt-2 inline-flex items-center gap-1.5', style: { color: C.inkSoft } }, e(Icon, { name: 'mapPin', size: 14 }), place(o))
            ),
            e('div', { className: 'col-span-2 md:col-span-1' },
                e(ProgressBar, { raised: o.amount_raised, total: o.total_price, color: meta.color, showLabel: false, thin: true }),
                e('div', { className: 'text-[13px] font-mono2 num mt-2', style: { color: C.inkSoft } }, GW.i18n.fmtNumber(Math.round(o.amount_raised / o.total_price * 100)) + '% · ' + t('list.of', { total: formatMAD(o.total_price) }))),
            e('div', { className: 'md:text-end' },
                funded
                    ? e('span', { className: 'inline-flex items-center gap-1.5 text-[15px] font-semibold', style: { color: C.sageText } }, e(Icon, { name: 'checkCircle', size: 16 }), t('card.fullyFunded'))
                    : e('div', null,
                        e('div', { className: 'font-display text-[24px] leading-none num', style: { color: C.ink } }, formatMAD(left)),
                        e('div', { className: 'text-[12px] font-mono2 mt-1', style: { color: C.inkSoft } }, t('needs.stillNeeded')))),
            e('div', { className: 'justify-self-end' }, funded ? null : e(FundLink, { offer: o }))
        );
    }

    GW.OfferList = function OfferList(props) {
        var store = GW.useStore();
        var query = props.query || {};
        var listRef = React.useRef(null);

        var allOffers = store.getOffers().filter(function (o) { return o.status === 'open' || o.status === 'funded'; });
        var visible = GW.filters.sortOffers(GW.filters.applyFilters(allOffers, query), query.sort);
        var open = visible.filter(function (o) { return o.status === 'open'; });
        var funded = visible.filter(function (o) { return o.status === 'funded'; });
        var featured = open[0] && !query.sort ? open[0] : null;
        var rows = featured ? open.slice(1) : open;

        GW.motion.useReveal(listRef, [JSON.stringify(query), visible.length, GW.i18n.lang]);

        // Arriving from News / the dashboard / the chatbot with filters: jump to the list.
        React.useEffect(function () {
            if (Object.keys(query).length) GW.router.goSection('wishes');
        }, []);

        var summary = [t('list.count', { n: open.length })]
            .concat(query.region ? [t('list.in', { place: regionLabel(query.region) })] : [])
            .join(' ') + (query.category ? ' · ' + categoryLabel(query.category) : '') + (query.urgent ? ' · ' + t('list.urgentOnly') : '');

        return e('section', { className: 'wrap py-16 md:py-28', ref: listRef },
            e(SectionHead, { n: props.n || '03', eyebrow: props.eyebrow || t('home.ebWishes'), title: t('list.title'), lede: t('list.sub') }),
            e(GW.filters.FilterBar, { query: query, offers: allOffers }),
            e('p', { className: 't-eyebrow mb-6', role: 'status', style: { color: C.inkSoft } }, summary),
            visible.length === 0
                ? e('div', { className: 'border-t py-16', style: { borderColor: C.ink } },
                    e('p', { className: 't-h3 font-display mb-2' }, t('list.empty')),
                    e('p', { className: 'mb-6', style: { color: C.inkSoft } }, t('list.emptySub')),
                    e(GhostButton, { onClick: function () { GW.router.navigate('/', {}); } }, t('filter.clear')))
                : null,
            featured ? e(Featured, { offer: featured }) : null,
            rows.length ? e('ul', { className: 'border-b', style: { borderColor: C.line } }, rows.map(function (o) { return e(Row, { key: o.id, offer: o }); })) : null,
            funded.length ? e('div', { className: 'mt-16' },
                e('h3', { className: 't-eyebrow mb-4', style: { color: C.sageText } }, t('list.fulfilledTitle') + ' · ' + GW.i18n.fmtNumber(funded.length)),
                e('ul', null, funded.map(function (o) { return e(Row, { key: o.id, offer: o }); }))) : null
        );
    };
})();
