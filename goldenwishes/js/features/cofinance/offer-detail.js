/* Golden Wishes — offer page #/offer/:id (feature 4). Laid out like an article: the story in a reading column,
 * the funding "receipt" in the margin (sticky on desktop). When a donation completes the wish while the page
 * is open, the fully funded moment plays once: the mark closes into a gold seal and a stamp settles in.
 */
window.GW = window.GW || {};

(function () {
    function FundedStamp(props) {
        var ref = React.useRef(null);
        React.useEffect(function () {
            if (!props.play || !ref.current || !GW.motion.enabled()) return;
            window.Motion.animate(ref.current, { opacity: [0, 1], transform: ['rotate(-4deg) scale(1.6)', 'rotate(-4deg) scale(1)'] }, { duration: 0.5, delay: 0.5, ease: GW.motion.EASE });
        }, [props.play]);
        return e('div', { ref: ref, role: 'status', className: 'inline-block border-2 px-3 py-1.5 t-eyebrow font-semibold', style: { borderColor: C.goldText, color: C.goldText, transform: 'rotate(-4deg)' } }, t('offer.fullyFunded'));
    }

    GW.OfferDetail = function OfferDetail(props) {
        var store = GW.useStore();
        var offer = store.getOffer(props.id);
        var s1 = useState(false); var checked = s1[0], setChecked = s1[1];
        var s2 = useState(false); var sealing = s2[0], setSealing = s2[1];
        var prevStatus = React.useRef(null);
        var pageRef = React.useRef(null);
        GW.motion.useReveal(pageRef, [!!offer]);

        // Always fetch the live amounts and recent donations for this wish.
        React.useEffect(function () {
            setChecked(false); setSealing(false); prevStatus.current = null;
            store.refreshOffer(props.id).then(function () { setChecked(true); });
        }, [props.id]);

        // The fully funded moment: only when the wish changes from open to funded in front of the donor.
        React.useEffect(function () {
            if (!offer) return;
            if (prevStatus.current === 'open' && offer.status === 'funded') setSealing(true);
            prevStatus.current = offer.status;
        }, [offer && offer.status]);

        if (!offer && !checked) {
            return e(PageShell, null, e('p', { className: 't-eyebrow', style: { color: C.inkSoft } }, t('common.loading')));
        }
        if (!offer) {
            return e(PageShell, { title: t('offer.notFound'), subtitle: t('offer.notFoundSub') },
                e('a', { href: '#/', className: 'inline-flex items-center gap-1.5 min-h-[44px] font-semibold link-draw', style: { color: C.purple } }, e(Icon, { name: 'arrowLeft', size: 16 }), t('app.backToWishes')));
        }

        var meta = CATEGORY_META[offer.category] || { icon: 'heart', color: C.purple };
        var funded = offer.status === 'funded';
        var left = store.remaining(offer);
        var contributions = store.getContributions(offer.id).slice(0, 8);
        var alias = offer.beneficiary_alias === 'Anonymous' ? t('offer.anonymous') : offer.beneficiary_alias;

        var article = e('article', { className: 'md:col-span-7' },
            e('div', { className: 'flex flex-wrap items-center gap-x-4 gap-y-2 mb-6' },
                e('span', { className: 't-eyebrow inline-flex items-center gap-1.5', style: { color: meta.color } }, e(Icon, { name: meta.icon, size: 15 }), categoryLabel(offer.category)),
                funded ? null : e(UrgencyBadge, { urgency: offer.urgency })),
            e('h1', { className: 't-h2 font-display md:text-[56px] mb-5', dir: 'auto' }, offer.title),
            e('p', { className: 'font-display text-[21px] md:text-[24px] leading-snug mb-8', dir: 'auto', style: { color: C.inkSoft } }, offer.description),
            e('ul', { className: 'grid sm:grid-cols-3 gap-y-4 gap-x-6 border-y py-5 mb-12 text-[15px]', style: { borderColor: C.line } },
                [['mapPin', cityLabel(offer.city) + ', ' + regionLabel(offer.region)], ['users', alias], ['handshake', relayLabel(offer.relay_point)]].map(function (m) {
                    return m[1] ? e('li', { key: m[0], className: 'flex items-start gap-2', style: { color: C.ink } },
                        e(Icon, { name: m[0], size: 16, style: { color: C.inkSoft, flexShrink: 0, marginTop: 3 } }), e('span', null, m[1])) : null;
                })),
            e('section', { 'aria-labelledby': 'story-h', 'data-reveal': '' },
                e('h2', { id: 'story-h', className: 't-eyebrow mb-5', style: { color: C.inkSoft } }, t('offer.story')),
                e('p', { className: 't-story story max-w-[62ch]', dir: 'auto', style: { color: C.ink } }, offer.backstory),
                e('p', { className: 'text-[14px] mt-6 max-w-[62ch]', style: { color: C.inkSoft } }, t('offer.anon'))),
            offer.verified_by ? e('p', { className: 'mt-10 flex items-center gap-2 text-[15px] border-t pt-6', 'data-reveal': '', style: { color: C.sageText, borderColor: C.line } },
                e(Icon, { name: 'shield', size: 17 }), t('offer.verified', { org: offer.verified_by })) : null,
            offer.tags && offer.tags.length && GW.i18n.lang === 'en' ? e('div', { className: 'flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[14px] font-mono2', style: { color: C.inkSoft } },
                offer.tags.map(function (tag) { return e('span', { key: tag, dir: 'ltr' }, '#' + tag); })) : null
        );

        var receipt = e('aside', { className: 'md:col-span-4 md:col-start-9' },
            e('div', { className: 'md:sticky md:top-24 border-t-2 pt-6', style: { borderColor: C.ink } },
                e('div', { className: 'flex items-start justify-between gap-4 mb-5' },
                    e('div', null,
                        e('div', { className: 'font-display text-[40px] leading-none num', style: { color: funded ? C.goldText : C.ink } },
                            e(GW.CountUp, { value: offer.amount_raised, format: function (n) { return formatMAD(Math.round(n * 100) / 100); } })),
                        e('div', { className: 't-eyebrow mt-3', style: { color: C.inkSoft } }, t('offer.raisedOf', { total: formatMAD(offer.total_price) }))),
                    e(WishMark, { filled: funded, seal: sealing, color: meta.color, size: 52 })),
                e(ProgressBar, { raised: offer.amount_raised, total: offer.total_price, color: meta.color, showLabel: false, className: 'mb-3' }),
                e('div', { className: 'text-[15px] mb-8 min-h-[36px] flex items-center', style: { color: C.inkSoft } },
                    funded ? e(FundedStamp, { play: sealing }) : e('span', null, tx('offer.stillNeeded', { amount: e('strong', { className: 'num', style: { color: C.ink } }, formatMAD(left)) }))),
                e(GW.FundPanel, { offer: offer }),
                contributions.length ? e('div', { className: 'mt-10' },
                    e('h2', { className: 't-eyebrow mb-3', style: { color: C.inkSoft } }, t('offer.recent')),
                    e('ul', null, contributions.map(function (c) {
                        return e('li', { key: c.id, className: 'flex justify-between gap-4 border-t py-3 text-[15px]', style: { borderColor: C.line } },
                            e('span', { dir: 'auto' }, c.donor_name === 'Anonymous' ? t('offer.anonymous') : c.donor_name),
                            e('span', { className: 'font-mono2 num', style: { color: C.ink } }, formatMAD(c.amount)));
                    }))) : null
            )
        );

        return e('div', { className: 'wrap py-10 md:py-16', ref: pageRef },
            e('a', { href: '#/', className: 'inline-flex items-center gap-1.5 min-h-[44px] text-[15px] font-semibold mb-8 link-draw', style: { color: C.inkSoft } },
                e(Icon, { name: 'arrowLeft', size: 16 }), t('offer.back')),
            e('div', { className: 'grid md:grid-cols-12 gap-x-10 gap-y-14' }, article, receipt)
        );
    };
})();
