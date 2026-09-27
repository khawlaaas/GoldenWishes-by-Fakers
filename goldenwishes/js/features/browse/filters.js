/* Golden Wishes — filters for the offer list (features 2 + 3). All state lives in the URL:
 *   #/?country=MA&region=Souss-Massa&category=Education
 * plus &sort=almost|newest and &urgent=1 (feature 3),
 * so News, the needs dashboard and the chatbot can link straight to a filtered list.
 */
window.GW = window.GW || {};

(function () {
    // Apply the URL filters to a list of offers.
    function applyFilters(offers, query) {
        return offers.filter(function (o) {
            if (o.status === 'pending_review') return false;
            if (query.country && o.country_code !== query.country) return false;
            if (query.region && o.region !== query.region) return false;
            if (query.category && o.category !== query.category) return false;
            if (query.urgent && o.urgency < 4) return false;
            return true;
        });
    }

    // Feature 3: sorting. Funded wishes always go last.
    function sorts() {
        return [
            { value: 'urgent', label: t('filter.sortUrgent') },
            { value: 'almost', label: t('filter.sortAlmost') },
            { value: 'newest', label: t('filter.sortNewest') }
        ];
    }
    function sortOffers(offers, sort) {
        function pct(o) { return o.amount_raised / o.total_price; }
        var cmp = {
            urgent: function (a, b) { return b.urgency - a.urgency || pct(b) - pct(a); },
            almost: function (a, b) { return pct(b) - pct(a) || b.urgency - a.urgency; },
            newest: function (a, b) { return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0; }
        }[sort] || null;
        if (!cmp) cmp = function (a, b) { return b.urgency - a.urgency || pct(b) - pct(a); };
        return offers.slice().sort(function (a, b) {
            var fa = a.status === 'funded' ? 1 : 0, fb = b.status === 'funded' ? 1 : 0;
            return fa - fb || cmp(a, b);
        });
    }

    function FilterSelect(props) {
        return e('label', { className: 'flex flex-col gap-1.5 t-eyebrow', style: { color: C.inkSoft } },
            props.label,
            e('select', {
                value: props.value || '', onChange: function (ev) { props.onChange(ev.target.value); },
                className: 'min-h-[44px] px-3 rounded-md border text-[15px] font-body normal-case tracking-normal min-w-[170px]',
                style: { borderColor: props.value ? C.purple : C.field, backgroundColor: '#fff', color: C.ink, letterSpacing: 0 }
            },
                e('option', { value: '' }, props.allLabel),
                props.options.map(function (o) { return e('option', { key: o.value, value: o.value }, o.label); })
            )
        );
    }

    function Chip(props) {
        return e('button', {
            onClick: props.onClick, 'aria-pressed': !!props.active,
            className: 'shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border text-[14px] font-semibold press whitespace-nowrap',
            style: props.active ? { backgroundColor: C.ink, color: C.paper, borderColor: C.ink } : { backgroundColor: 'transparent', color: C.ink, borderColor: C.field }
        }, props.icon ? e(Icon, { name: props.icon, size: 15 }) : null, props.children);
    }

    // Category chips (scroll sideways on phones), then country / region / sort / urgent. Everything goes into the URL.
    function FilterBar(props) {
        var query = props.query, offers = props.offers;
        function set(patch) { GW.router.navigate('/', Object.assign({}, query, patch)); }

        var countries = {};
        offers.forEach(function (o) { countries[o.country_code] = o.country; });
        var countryOptions = Object.keys(countries).sort().map(function (cc) { return { value: cc, label: countryLabel(cc, countries[cc]) }; });

        var regions = {};
        offers.forEach(function (o) { if (!query.country || o.country_code === query.country) regions[o.region] = true; });
        var regionOptions = Object.keys(regions).map(function (r) { return { value: r, label: regionLabel(r) }; })
            .sort(function (a, b) { return a.label.localeCompare(b.label, GW.i18n.lang); });

        var active = !!(query.country || query.region || query.category || query.urgent || query.sort);
        var cats = GW.schema.CATEGORIES.filter(function (c) { return offers.some(function (o) { return o.category === c; }); });

        return e('div', { className: 'mb-8', role: 'search', 'aria-label': t('list.filters') },
            e('div', { className: 'flex gap-2 overflow-x-auto pb-3 -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap' },
                e(Chip, { active: !query.category, onClick: function () { set({ category: '' }); } }, t('cat.all')),
                cats.map(function (c) {
                    return e(Chip, { key: c, icon: (CATEGORY_META[c] || {}).icon, active: query.category === c, onClick: function () { set({ category: query.category === c ? '' : c }); } }, categoryLabel(c));
                })
            ),
            e('div', { className: 'flex flex-wrap items-end gap-3 mt-4' },
                countryOptions.length > 1 ? e(FilterSelect, {
                    label: t('filter.country'), allLabel: t('filter.allCountries'), value: query.country, options: countryOptions,
                    onChange: function (v) { set({ country: v, region: '' }); }
                }) : null,
                e(FilterSelect, {
                    label: t('filter.region'), allLabel: t('filter.allRegions'), value: query.region, options: regionOptions,
                    onChange: function (v) {
                        var match = offers.filter(function (o) { return o.region === v; })[0];
                        set({ region: v, country: match ? match.country_code : query.country });
                    }
                }),
                e(FilterSelect, {
                    label: t('filter.sort'), allLabel: t('filter.sortUrgent'), value: query.sort && query.sort !== 'urgent' ? query.sort : '',
                    options: sorts().slice(1), onChange: function (v) { set({ sort: v }); }
                }),
                e('button', {
                    onClick: function () { set({ urgent: query.urgent ? '' : '1' }); }, 'aria-pressed': !!query.urgent,
                    className: 'inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md border text-[15px] font-semibold press',
                    style: query.urgent ? { backgroundColor: C.pinkText, color: '#fff', borderColor: C.pinkText } : { color: C.pinkText, borderColor: C.pinkText, backgroundColor: 'transparent' }
                }, e(Icon, { name: 'alert', size: 15 }), t('filter.urgentOnly')),
                active ? e('button', {
                    onClick: function () { GW.router.navigate('/', {}); },
                    className: 'inline-flex items-center min-h-[44px] px-2 text-[15px] font-semibold link-draw', style: { color: C.purple }
                }, t('filter.clear')) : null
            )
        );
    }

    GW.filters = { applyFilters: applyFilters, sortOffers: sortOffers, FilterBar: FilterBar, FilterSelect: FilterSelect };
})();
