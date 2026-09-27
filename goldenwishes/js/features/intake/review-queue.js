/* Golden Wishes — review queue #/review (feature 7). Reviewers check pending needs,
 * run the trust check, then approve (the wish goes live, is embedded for the chat and translated) or reject.
 * Nothing is deleted. On the live site these actions need the review code (REVIEW_CODE).
 */
window.GW = window.GW || {};

(function () {
    function ReviewCard(props) {
        var o = props.offer;
        var s1 = useState(null); var busy = s1[0], setBusy = s1[1];
        var s2 = useState(null); var note = s2[0], setNote = s2[1];
        var s3 = useState(''); var error = s3[0], setError = s3[1];
        var meta = CATEGORY_META[o.category] || { icon: 'heart', color: C.purple };

        function act(label, promise) {
            setBusy(label); setError('');
            return promise.then(function (r) {
                setBusy(null);
                if (!r.ok) setError(errorText(r));
                props.onChange();
                return r;
            });
        }
        function check() {
            setBusy('checking'); setError('');
            GW.runTrustCheck(o).then(function (res) {
                setNote(res.note);
                act('saving', GW.store.review(o.id, 'trust', { score: res.trust.score, reasons: res.trust.reasons }));
            });
        }
        function approve() { act('approving', GW.store.review(o.id, 'approve')); }
        function reject() { act('rejecting', GW.store.review(o.id, 'reject')); }

        var risky = o.trust && o.trust.score < 45;
        return e('li', { 'data-reveal': '', className: 'grid md:grid-cols-12 gap-x-10 gap-y-6 border-t py-8', style: { borderColor: C.ink } },
            e('div', { className: 'md:col-span-7' },
                e('div', { className: 'flex flex-wrap items-center gap-x-4 gap-y-1 mb-3' },
                    e('span', { className: 't-eyebrow inline-flex items-center gap-1.5', style: { color: meta.color } }, e(Icon, { name: meta.icon, size: 14 }), categoryLabel(o.category)),
                    e(UrgencyBadge, { urgency: o.urgency })),
                e('h2', { className: 't-h3 font-display mb-2', dir: 'auto' }, o.title),
                e('p', { className: 'text-[16px] mb-4', dir: 'auto', style: { color: C.inkSoft } }, o.description),
                e('p', { className: 'text-[16px] leading-relaxed border-s-2 ps-4 mb-5', dir: 'auto', style: { borderColor: C.line, color: C.ink } }, o.backstory),
                e('div', { className: 'flex flex-wrap gap-x-6 gap-y-2 text-[14px]', style: { color: C.inkSoft } },
                    e('div', { className: 'inline-flex items-center gap-1.5' }, e(Icon, { name: 'mapPin', size: 14 }), cityLabel(o.city) + ', ' + regionLabel(o.region)),
                    e('div', null, t('review.submitted', { date: GW.i18n.fmtDate(o.created_at) })),
                    o.review_note ? e('div', { dir: 'auto' }, o.review_note) : null,
                    e('div', null, t('review.price') + ' ', e('strong', { className: 'font-mono2 num', style: { color: C.ink } }, formatMAD(o.total_price)))))
            ,
            e('div', { className: 'md:col-span-5 space-y-5' },
                o.trust ? e(GW.TrustPanel, { trust: o.trust, note: note })
                    : e('p', { className: 'text-[15px] border-s-2 border-dashed ps-4 py-3', style: { borderColor: C.field, color: C.inkSoft } }, t('review.notChecked')),
                e('div', { className: 'flex flex-wrap gap-3' },
                    e(GhostButton, { disabled: !!busy, onClick: check, style: { borderColor: C.purple, color: C.purple } }, busy === 'checking' ? t('review.checking') : (o.trust ? t('review.recheck') : t('review.check'))),
                    e(PrimaryButton, { disabled: !!busy, onClick: approve, style: risky ? { backgroundColor: C.inkSoft } : null, title: risky ? t('review.riskyTitle') : '' }, busy === 'approving' ? t('review.approving') : t('review.approve')),
                    e('button', { disabled: !!busy, onClick: reject, className: 'inline-flex items-center min-h-[44px] px-3 text-[15px] font-semibold link-draw', style: { color: C.pinkText } }, busy === 'rejecting' ? t('review.rejecting') : t('review.reject'))),
                risky ? e('p', { className: 'text-[14px] font-semibold', style: { color: '#B03A3A' } }, t('review.risky')) : null,
                error ? e('p', { role: 'alert', className: 'text-[14px]', style: { color: C.pinkText } }, error) : null)
        );
    }

    function CodeForm(props) {
        var s = useState(''); var code = s[0], setCode = s[1];
        return e('form', {
            className: 'max-w-md border-t-2 pt-6 space-y-4', style: { borderColor: C.ink },
            onSubmit: function (ev) { ev.preventDefault(); GW.store.setReviewCode(code.trim()); props.onDone(); }
        },
            e('p', { className: 'text-[16px]', role: props.error ? 'alert' : null, style: { color: props.error ? C.pinkText : C.inkSoft } }, props.error || t('review.codePrompt')),
            e('label', { className: 'block' },
                e('span', { className: 't-eyebrow block mb-1.5', style: { color: C.inkSoft } }, t('review.codePh')),
                e(TextField, { type: 'password', autoComplete: 'current-password', value: code, onChange: function (ev) { setCode(ev.target.value); }, autoFocus: true })),
            e(PrimaryButton, { type: 'submit', disabled: !code.trim() }, t('review.open'))
        );
    }

    GW.ReviewPage = function ReviewPage() {
        var store = GW.useStore();
        var s1 = useState(null); var queue = s1[0], setQueue = s1[1];
        var s2 = useState(''); var resetMsg = s2[0], setResetMsg = s2[1];
        var ref = React.useRef(null);

        function reload() { store.loadReviewQueue().then(setQueue); }
        React.useEffect(reload, []);
        GW.motion.useReveal(ref, [queue && queue.ok && queue.pending.length]);

        if (!queue) return e(PageShell, { eyebrow: t('nav.review'), title: t('review.title') }, e('p', { className: 't-eyebrow', style: { color: C.inkSoft } }, t('common.loading')));
        if (!queue.ok && (queue.status === 401 || queue.status === 403)) {
            return e(PageShell, { eyebrow: t('nav.review'), title: t('review.title'), subtitle: t('review.subLocked') },
                e(CodeForm, { error: queue.status === 403 || queue.code === 'bad_code' ? errorText(queue) : null, onDone: reload }));
        }
        if (!queue.ok) return e(PageShell, { eyebrow: t('nav.review'), title: t('review.title') }, e('p', { role: 'alert', style: { color: C.pinkText } }, errorText(queue)));

        var pending = queue.pending;
        var approved = queue.recent.filter(function (o) { return o.status !== 'rejected'; });
        var rejected = queue.recent.filter(function (o) { return o.status === 'rejected'; });

        function resetDemo() {
            if (!window.confirm(t('review.resetConfirm'))) return;
            setResetMsg(t('review.resetting'));
            store.reset().then(function (r) {
                setResetMsg(r.ok ? (r.removed === null ? t('review.resetLocal') : t('review.resetDone', { n: r.removed })) : errorText(r));
                reload();
            });
        }

        function Count(p) {
            return e('div', null,
                e('div', { className: 'font-display text-[36px] leading-none num', style: { color: p.color || C.ink } }, GW.i18n.fmtNumber(p.n)),
                e('div', { className: 't-eyebrow mt-2', style: { color: C.inkSoft } }, p.label));
        }

        return e('section', { className: 'wrap py-12 md:py-20', ref: ref },
            e(SectionHead, { as: 'h1', eyebrow: t('nav.review'), title: t('review.title'), lede: t('review.sub') }),
            e('div', { className: 'flex flex-wrap items-end gap-x-12 gap-y-6 border-y py-6 mb-12', style: { borderColor: C.line } },
                e(Count, { n: pending.length, label: t('review.lblPending'), color: C.purple }),
                e(Count, { n: approved.length, label: t('review.lblApproved'), color: C.sageText }),
                e(Count, { n: rejected.length, label: t('review.lblRejected'), color: C.pinkText }),
                e('div', { className: 'ms-auto flex flex-wrap items-center gap-4' },
                    e('a', { href: '#/make-a-wish', className: 'inline-flex items-center min-h-[44px] font-semibold link-draw', style: { color: C.purple } }, t('review.submit')),
                    e(GhostButton, { onClick: resetDemo, style: { borderColor: C.pinkText, color: C.pinkText } }, t('review.reset')),
                    resetMsg ? e('span', { 'data-test': 'reset-msg', role: 'status', className: 'text-[14px]', style: { color: C.inkSoft } }, resetMsg) : null)),
            pending.length === 0 ? e('p', { className: 't-h3 font-display py-10', style: { color: C.inkSoft } }, t('review.empty')) : null,
            e('ol', null, pending.map(function (o) { return e(ReviewCard, { key: o.id, offer: o, onChange: reload }); })),
            approved.length || rejected.length ? e('div', { className: 'grid md:grid-cols-2 gap-x-10 gap-y-10 mt-16 border-t pt-10', style: { borderColor: C.ink } },
                e('div', null,
                    e('h2', { className: 't-eyebrow mb-4', style: { color: C.sageText } }, t('review.recentApproved')),
                    approved.length ? e('ul', null, approved.map(function (o) {
                        return e('li', { key: o.id }, e('a', { href: '#/offer/' + o.id, dir: 'auto', className: 'flex items-center min-h-[44px] border-t text-[15px] link-draw', style: { borderColor: C.line, color: C.ink } }, o.title));
                    })) : e('p', { style: { color: C.inkSoft } }, '—')),
                e('div', null,
                    e('h2', { className: 't-eyebrow mb-4', style: { color: C.pinkText } }, t('review.rejectedTitle')),
                    rejected.length ? e('ul', null, rejected.map(function (o) {
                        return e('li', { key: o.id, className: 'flex items-center justify-between gap-4 min-h-[44px] border-t text-[15px]', style: { borderColor: C.line, color: C.inkSoft } },
                            e('span', { dir: 'auto' }, o.title),
                            e('button', { className: 'inline-flex items-center min-h-[44px] px-2 font-semibold link-draw', style: { color: C.purple }, onClick: function () { store.review(o.id, 'restore').then(reload); } }, t('review.restore')));
                    })) : e('p', { style: { color: C.inkSoft } }, '—'))) : null
        );
    };
})();
