/* Golden Wishes — "Submit a need" page #/make-a-wish (feature 7).
 * 1. Messy text -> /api/intake (NVIDIA) -> clean, anonymized draft (editable)
 * 2. /api/trust-check -> score + reasons (rules alone if the AI is down)
 * 3. Saved in the database as pending_review (/api/submit-wish); nothing is public before a reviewer approves it in #/review.
 */
window.GW = window.GW || {};

(function () {
    var EXAMPLE = 'salam, kayn wahed lweld smito Amine Tazi 3ndo 8 snin f Agadir, walidih ma3ndhomch bach ychriw lih nwader, ma kaychofch mzyan f l9ism w l mo3alima 9alet khasso nwader. nwader kaytklfo 400 dh. tel dyal mo 0661234567';

    // Trust result: level, score, reasons. Colors are text-safe; the level is also written in words.
    function TrustPanel(props) {
        var trust = props.trust;
        var lv = GW.trustRules.level(trust.score);
        return e('div', { role: 'status', className: 'border-s-4 ps-5 py-2', style: { borderColor: lv.color } },
            e('div', { className: 'flex items-baseline justify-between gap-4 mb-3' },
                e('div', { className: 'flex items-center gap-2 font-semibold text-[16px]', style: { color: lv.color } },
                    e(Icon, { name: lv.key === 'low' ? 'shield' : 'alert', size: 18 }), lv.label),
                e('div', { className: 'font-display text-[36px] leading-none num', style: { color: lv.color } }, trust.score, e('span', { className: 'text-[16px]' }, '/100'))),
            e('ul', { className: 'text-[15px] leading-relaxed space-y-1.5 list-disc ps-5', style: { color: C.ink } },
                trust.reasons.map(function (r, i) { return e('li', { key: i, dir: 'auto' }, r); })),
            props.note ? e('p', { className: 'text-[13px] mt-3', style: { color: C.inkSoft } }, props.note) : null
        );
    }
    GW.TrustPanel = TrustPanel;

    // Run the trust check for an offer; falls back to rules computed in the browser.
    GW.runTrustCheck = function (offer) {
        return GW.api.post('trust-check', { offer: offer, lang: GW.i18n.lang }, { timeoutMs: 15000 }).then(function (r) {
            if (r.ok) return { trust: r.data.trust, note: t(r.data.trust.ai ? 'trust.noteAi' : 'trust.noteRules') };
            var rules = GW.trustRules.checkRules(offer, GW.store.getOffers());
            return { trust: { score: rules.score, reasons: rules.flags.map(function (f) { return f.reason; }), level: GW.trustRules.level(rules.score).key, ai: null }, note: t('trust.noteRulesErr', { error: errorText(r) }) };
        });
    };

    function Field(props) {
        return e('label', { className: 'block ' + (props.className || '') },
            e('span', { className: 't-eyebrow block mb-1.5', style: { color: C.inkSoft } }, props.label),
            props.children);
    }

    function Step(props) {
        return e('div', { className: 'flex items-baseline gap-3 border-t pt-5 mb-6', style: { borderColor: props.active ? C.ink : C.line } },
            e('span', { className: 'font-mono2 num text-[13px]', style: { color: props.active ? C.purple : C.inkSoft } }, props.n),
            e('h2', { className: 't-h3 font-display', style: { color: props.active ? C.ink : C.inkSoft } }, props.title));
    }

    GW.MakeAWishPage = function MakeAWishPage() {
        var s1 = useState(''); var text = s1[0], setText = s1[1];
        var s2 = useState(null); var draft = s2[0], setDraft = s2[1];
        var s3 = useState(null); var busy = s3[0], setBusy = s3[1];
        var s4 = useState(''); var error = s4[0], setError = s4[1];
        var s5 = useState(null); var check = s5[0], setCheck = s5[1];
        var s6 = useState(null); var saved = s6[0], setSaved = s6[1];
        var s7 = useState(''); var submitter = s7[0], setSubmitter = s7[1];
        var s8 = useState(''); var rawUsed = s8[0], setRawUsed = s8[1];   // the text the draft was built from (private)

        function structure() {
            setError(''); setCheck(null); setSaved(null); setBusy(t('intake.busyStructuring'));
            GW.api.post('intake', { text: text }, { timeoutMs: 15000 }).then(function (r) {
                setBusy(null);
                setRawUsed(text);
                if (!r.ok) { setError(t('intake.aiFailed', { error: errorText(r) })); setDraft(emptyDraft()); return; }
                setDraft(r.data.draft);
            });
        }

        function emptyDraft() {
            return { title: '', description: '', backstory: text, beneficiary_alias: '', category: 'essentials', tags: [], country: 'Morocco', country_code: 'MA', region: 'Casablanca-Settat', city: '', urgency: 3, total_price: null };
        }

        function set(k, v) { setDraft(Object.assign({}, draft, (function () { var o = {}; o[k] = v; return o; })())); setCheck(null); }

        function toOffer() {
            return Object.assign({}, draft, {
                total_price: Math.round(Number(draft.total_price) * 100) / 100 || 0,
                urgency: GW.mapping.URGENCY_TO_NUM[GW.mapping.urgencyToEnum(draft.urgency)],
                currency: 'MAD', amount_raised: 0, status: 'pending_review', verified_by: null, trust: null, image_url: null,
                id: 'off_new', created_at: new Date().toISOString()
            });
        }

        var problems = draft ? GW.schema.invalidFields(toOffer()) : [];

        function runCheck() {
            setBusy(t('intake.busyChecking'));
            GW.runTrustCheck(toOffer()).then(function (res) { setBusy(null); setCheck(res); });
        }

        function submit() {
            var offer = toOffer();
            delete offer.id;
            setBusy(t('common.saving')); setError('');
            GW.store.addPendingOffer(offer, {
                trust: check ? { score: check.trust.score, reasons: check.trust.reasons } : null,
                raw_text: rawUsed || text,
                submitted_by: submitter.trim().slice(0, 80)
            }).then(function (r) {
                setBusy(null);
                if (!r.ok) { setError(errorText(r)); return; }
                setSaved(offer);
            });
        }

        if (saved) {
            return e(PageShell, { eyebrow: t('nav.submit'), title: t('intake.savedTitle') },
                e('p', { className: 'text-[17px] mb-8 max-w-2xl', style: { color: C.inkSoft } }, t('intake.savedBody', { title: saved.title })),
                e('div', { className: 'flex flex-wrap gap-3' },
                    e('a', { href: '#/review', className: 'inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-md font-semibold press', style: { backgroundColor: C.purple, color: '#fff' } }, t('intake.openQueue'), e(Icon, { name: 'arrowRight', size: 15 })),
                    e(GhostButton, { onClick: function () { setSaved(null); setDraft(null); setText(''); setCheck(null); } }, t('intake.another')))
            );
        }

        var saving = busy === t('common.saving');
        return e(PageShell, { eyebrow: t('nav.submit'), title: t('intake.title'), subtitle: t('intake.sub') },
            e('div', { className: 'grid md:grid-cols-12 gap-x-10 gap-y-12' },
                e('div', { className: 'md:col-span-5' },
                    e(Step, { n: '01', title: t('intake.step1'), active: !draft }),
                    e('label', { className: 'block' },
                        e('span', { className: 'sr-only' }, t('intake.step1')),
                        e(TextArea, { rows: 10, value: text, placeholder: t('intake.textPh'), dir: 'auto', onChange: function (ev) { setText(ev.target.value); } })),
                    e('div', { className: 'flex flex-wrap gap-3 items-center mt-4' },
                        e(PrimaryButton, { disabled: text.trim().length < 20 || !!busy, onClick: structure }, e(Icon, { name: 'sparkles', size: 16 }), t('intake.structure')),
                        e('button', { className: 'inline-flex items-center min-h-[44px] px-2 text-[15px] font-semibold link-draw', style: { color: C.purple }, onClick: function () { setText(EXAMPLE); } }, t('intake.example'))),
                    e('p', { className: 'flex items-start gap-3 mt-6 text-[14px] leading-relaxed border-s-2 ps-4', style: { borderColor: C.purple, color: C.ink } },
                        e(Icon, { name: 'shield', size: 17, style: { color: C.purple, flexShrink: 0, marginTop: 3 } }), t('intake.privacy')),
                    busy ? e('p', { role: 'status', className: 'mt-5 text-[14px] font-mono2 flex items-center gap-2', style: { color: C.inkSoft } },
                        e('span', { className: 'w-2 h-2 rounded-full animate-pulse', style: { backgroundColor: C.gold } }), busy) : null,
                    error ? e('p', { role: 'alert', className: 'mt-5 text-[14px] border-s-2 ps-3', style: { color: C.pinkText, borderColor: C.pinkText } }, error) : null
                ),
                e('div', { className: 'md:col-span-7' },
                    e(Step, { n: '02', title: t('intake.step2'), active: !!draft && !check }),
                    draft ? e('div', { className: 'space-y-5' },
                        e('p', { className: 'text-[14px]', style: { color: C.inkSoft } }, t('intake.englishNote')),
                        e(Field, { label: t('intake.fTitle') }, e(TextField, { dir: 'ltr', value: draft.title, onChange: function (ev) { set('title', ev.target.value); } })),
                        e(Field, { label: t('intake.fSummary') }, e(TextField, { dir: 'ltr', value: draft.description, onChange: function (ev) { set('description', ev.target.value); } })),
                        e(Field, { label: t('intake.fStory') }, e(TextArea, { dir: 'ltr', rows: 6, value: draft.backstory, onChange: function (ev) { set('backstory', ev.target.value); } })),
                        e('div', { className: 'grid sm:grid-cols-2 gap-5' },
                            e(Field, { label: t('intake.fCategory') }, e(Select, { value: draft.category, onChange: function (ev) { set('category', ev.target.value); } },
                                GW.schema.CATEGORIES.map(function (c) { return e('option', { key: c, value: c }, categoryLabel(c)); }))),
                            e(Field, { label: t('intake.fUrgency') }, e(Select, { value: draft.urgency, onChange: function (ev) { set('urgency', Number(ev.target.value)); } },
                                [1, 3, 4, 5].map(function (u) { return e('option', { key: u, value: u }, t('urgency.badge', { label: urgencyLabel(u), n: u })); }))),
                            e(Field, { label: t('intake.fCity') }, e(TextField, { value: draft.city, onChange: function (ev) { set('city', ev.target.value); } })),
                            e(Field, { label: t('intake.fRegion') }, e(Select, { value: draft.region, onChange: function (ev) { set('region', ev.target.value); } },
                                GW.localParse.MA_REGIONS.map(function (r) { return e('option', { key: r, value: r }, regionLabel(r)); }))),
                            e(Field, { label: t('intake.fPrice') }, e(TextField, { type: 'number', inputMode: 'decimal', min: 1, step: '0.01', value: draft.total_price || '', placeholder: t('intake.pricePh'), onChange: function (ev) { set('total_price', ev.target.value); } })),
                            e(Field, { label: t('intake.fBy') }, e(TextField, { value: submitter, placeholder: t('common.optional'), onChange: function (ev) { setSubmitter(ev.target.value); } }))),
                        problems.length ? e('p', { role: 'alert', className: 'text-[14px]', style: { color: C.pinkText } }, t('intake.toFix', { fields: problems.map(function (f) { return t('field.' + f); }).join(', ') })) : null,
                        e('div', { className: 'pt-6' },
                            e(Step, { n: '03', title: t('intake.step3'), active: !!check }),
                            check ? e('div', { className: 'mb-6' }, e(TrustPanel, { trust: check.trust, note: check.note })) : null,
                            e('div', { className: 'flex flex-wrap gap-3' },
                                e(GhostButton, { disabled: !!busy || problems.length > 0, onClick: runCheck, style: { borderColor: C.purple, color: C.purple } }, check ? t('intake.rerunCheck') : t('intake.runCheck')),
                                e(PrimaryButton, { disabled: !check || !!busy || problems.length > 0, onClick: submit }, saving ? busy : t('intake.send'))))
                    ) : e('p', { className: 'text-[15px] border-s-2 border-dashed ps-5 py-8', style: { borderColor: C.field, color: C.inkSoft } }, t('intake.placeholder'))
                )
            )
        );
    };
})();
