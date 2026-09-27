/* Golden Wishes — AI chat assistant (feature 6).
 * Pipeline, one model call per step, run in sequence from the browser:
 *   1. /api/chat-parse   free text -> { budget, categories, place, query_en, language }   (fallback: keyword parser)
 *   2. /api/embed        query_en -> vector, cosine vs precomputed offer vectors          (fallback: TF-IDF)
 *   3. GW.allocate       split the budget in plain JS
 *   4. /api/chat-explain one sentence per chosen wish, in the site language, no numbers  (fallback: templates)
 *   5. "Fund this plan"  GW.store.contribute for each wish, one after the other (database donations)
 * Donors may write in Darija, French, English or Arabic; answers follow the language chosen in the header.
 * Open it from anywhere with: window.dispatchEvent(new CustomEvent('gw:open-chat', { detail: { message } }))
 */
window.GW = window.GW || {};

(function () {
    function PlanMessage(props) {
        var m = props.msg;
        var s1 = useState(''); var donor = s1[0], setDonor = s1[1];
        var s2 = useState(null); var result = s2[0], setResult = s2[1];
        var s3 = useState(false); var funding = s3[0], setFunding = s3[1];

        // Donations in sequence; stop at the first refusal (e.g. someone else just funded that wish).
        function fundPlan() {
            var done = [], failed = [];
            setFunding(true);
            m.items.reduce(function (p, it) {
                return p.then(function (stop) {
                    if (stop) return true;
                    return GW.store.contribute(it.offer.id, it.amount, { name: donor || t('chat.donorDefault') }).then(function (r) {
                        if (r.ok) { done.push({ offer: r.offer, amount: it.amount }); return false; }
                        failed.push({ offer: it.offer, error: errorText(r) }); return true;
                    });
                });
            }, Promise.resolve(false)).then(function () { setFunding(false); setResult({ done: done, failed: failed }); });
        }

        var filterQuery = { category: (m.parsed.categories || [])[0], region: m.parsed.region || undefined, country: m.parsed.region ? undefined : m.parsed.country_code || undefined };

        var doneIds = {};
        if (result) result.done.forEach(function (d) { doneIds[d.offer.id] = true; });

        return e('div', { className: 'space-y-4' },
            e('p', { className: 'text-[15px] leading-relaxed', 'data-test': 'chat-intro', dir: 'auto' }, m.intro || t('chat.intro')),
            e('ol', { className: 'border-t', style: { borderColor: C.line } }, m.items.map(function (it) {
                var meta = CATEGORY_META[it.offer.category] || { icon: 'heart', color: C.purple };
                var live = GW.store.getOffer(it.offer.id) || it.offer;
                var sealed = live.status === 'funded';
                return e('li', { key: it.offer.id, className: 'grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 items-start border-b py-4', style: { borderColor: C.line } },
                    e(WishMark, { color: meta.color, filled: sealed, seal: sealed && doneIds[it.offer.id], size: 30 }),
                    e('div', { className: 'min-w-0' },
                        e('a', { href: '#/offer/' + it.offer.id, className: 'font-display text-[17px] leading-snug hover:opacity-80', dir: 'auto' }, live.title),
                        e('div', { className: 'text-[12px] font-mono2 mt-1 flex flex-wrap gap-x-2', style: { color: C.inkSoft } },
                            e('span', null, categoryLabel(it.offer.category)), e('span', null, '· ' + cityLabel(it.offer.city)),
                            it.completes ? e('span', { style: { color: C.sageText } }, '· ' + t('chat.completes')) : null)),
                    e('span', { className: 'font-mono2 num text-[15px] whitespace-nowrap', style: { color: C.ink } }, formatMAD(it.amount)),
                    e('p', { className: 'col-start-2 col-span-2 text-[14px] leading-relaxed mt-1', 'data-test': 'chat-reason', dir: 'auto', style: { color: C.inkSoft } }, m.reasons[it.offer.id] || t('chat.reason', { title: live.title, city: cityLabel(it.offer.city) })),
                    e('div', { className: 'col-start-2 col-span-2 mt-2' }, e(ProgressBar, { raised: live.amount_raised, total: live.total_price, color: meta.color, showLabel: false, thin: true }))
                );
            })),
            e('div', { className: 'flex justify-between items-baseline text-[15px] font-semibold' },
                e('span', null, t('chat.total')), e('span', { className: 'font-mono2 num' }, formatAmount(m.total) + ' / ' + formatMAD(m.budget))),
            m.leftover > 0 ? e('p', { className: 'text-[13px]', style: { color: C.inkSoft } }, t('chat.leftover', { amount: formatMAD(m.leftover) })) : null,
            result ? e('div', { role: 'status', className: 'border-s-2 ps-4 py-1 text-[14px] space-y-1', style: { borderColor: C.sageText } },
                e('div', { className: 'font-semibold', style: { color: C.sageText } }, t('chat.funded')),
                result.done.map(function (d) {
                    return e('div', { key: d.offer.id }, '✓ ' + formatMAD(d.amount) + ' · ', e('a', { href: '#/offer/' + d.offer.id, className: 'underline', dir: 'auto' }, d.offer.title));
                }),
                result.failed.map(function (f) {
                    return e('div', { key: f.offer.id, style: { color: C.pinkText } }, '✗ ' + f.offer.title + ': ' + f.error);
                })
            ) : e('div', { className: 'space-y-3' },
                e('label', { className: 'block' }, e('span', { className: 't-eyebrow block mb-1.5', style: { color: C.inkSoft } }, t('chat.namePh')),
                    e(TextField, { value: donor, onChange: function (ev) { setDonor(ev.target.value); }, autoComplete: 'name' })),
                e(PrimaryButton, { onClick: fundPlan, disabled: funding, style: { width: '100%' } }, funding ? t('common.saving') : t('chat.fund') + ' · ' + formatMAD(m.total))
            ),
            e('a', { href: GW.router.buildHash('/', filterQuery), className: 'inline-flex items-center gap-1.5 min-h-[44px] text-[14px] font-semibold link-draw', style: { color: C.purple } }, t('chat.seeAll'), e(Icon, { name: 'arrowRight', size: 14 })),
            e('p', { className: 'text-[11px] font-mono2 leading-relaxed', 'data-test': 'chat-trace', style: { color: C.inkSoft } }, m.trace.map(function (k) { return t(k); }).join(' · '))
        );
    }

    GW.ChatWidget = function ChatWidget() {
        GW.useStore();
        GW.useLang();
        var s1 = useState(false); var open = s1[0], setOpen = s1[1];
        // System messages keep their dictionary key, so they follow a language switch.
        var s2 = useState([{ role: 'assistant', key: 'chat.hello' }]); var msgs = s2[0], setMsgs = s2[1];
        var s3 = useState(''); var input = s3[0], setInput = s3[1];
        var s4 = useState(null); var busy = s4[0], setBusy = s4[1];
        var ctxRef = React.useRef(null);   // remembers the last request (for "how much?" follow-ups)
        var endRef = React.useRef(null);
        var inputRef = React.useRef(null);
        React.useEffect(function () {
            if (!open) return undefined;
            if (inputRef.current) inputRef.current.focus();
            function onKey(ev) { if (ev.key === 'Escape') setOpen(false); }
            window.addEventListener('keydown', onKey);
            return function () { window.removeEventListener('keydown', onKey); };
        }, [open]);

        React.useEffect(function () {
            function onOpen(ev) {
                setOpen(true);
                if (ev.detail && ev.detail.message) setInput(ev.detail.message);
            }
            window.addEventListener('gw:open-chat', onOpen);
            return function () { window.removeEventListener('gw:open-chat', onOpen); };
        }, []);
        React.useEffect(function () { if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);

        function add(m) { setMsgs(function (prev) { return prev.concat([m]); }); }

        function send(textArg) {
            var message = String(textArg !== undefined ? textArg : input).trim();
            if (!message || busy) return;
            setInput('');
            add({ role: 'user', text: message });
            run(message).catch(function (err) {
                console.error(err);
                add({ role: 'assistant', key: 'chat.error' });
            }).finally(function () { setBusy(null); });
        }

        function run(message) {
            var trace = [];
            var parsed;
            var lang = GW.i18n.lang;
            setBusy('chat.busyUnderstanding');
            GW.match.loadEmbeddings();
            return GW.api.post('chat-parse', { message: message }, { timeoutMs: 12000 }).then(function (r) {
                if (r.ok) {
                    parsed = r.data.parsed;
                    trace.push(parsed.source === 'nvidia' ? 'chat.trace.nvidia' : 'chat.trace.demo');
                } else {
                    parsed = GW.localParse.parseLocal(message);
                    trace.push('chat.trace.keywords');
                }
                // Follow-up like "300 dh": keep what the previous message asked for.
                var prev = ctxRef.current;
                if (prev) {
                    if (!parsed.categories.length && prev.categories.length) { parsed.categories = prev.categories; parsed.query_en = prev.query_en + ' ' + parsed.query_en; }
                    if (!parsed.region && prev.region) { parsed.region = prev.region; parsed.country_code = prev.country_code; }
                    if (!parsed.budget && prev.budget) parsed.budget = prev.budget;
                }
                ctxRef.current = parsed;
                if (!parsed.budget) {
                    add({ role: 'assistant', key: 'chat.askBudget' });
                    return null;
                }

                setBusy('chat.busyFinding');
                return Promise.all([
                    GW.api.post('embed', { text: parsed.query_en }, { timeoutMs: 10000 }),
                    GW.match.loadEmbeddings()
                ]).then(function (res) {
                    var vector = res[0].ok ? res[0].data.vector : null;
                    var ranked = GW.match.rank(GW.store.getOffers(), parsed, vector);
                    var plan = GW.allocate(ranked, parsed.budget, 3);
                    if (!plan.items.length) {
                        add({ role: 'assistant', key: 'chat.noMatch' });
                        return null;
                    }
                    trace.push(plan.items[0].method === 'embedding' ? 'chat.trace.embed' : 'chat.trace.tfidf');
                    trace.push('chat.trace.split');

                    setBusy('chat.busyExplaining');
                    var items = plan.items.map(function (it) {
                        var o = it.offer;
                        return { id: o.id, title: o.title, description: o.description, category: o.category, city: o.city, region: o.region, urgency: o.urgency, total_price: o.total_price, remaining: GW.store.remaining(o), amount: it.amount };
                    });
                    return GW.api.post('chat-explain', { message: message, language: lang, budget: parsed.budget, items: items }, { timeoutMs: 12000 }).then(function (ex) {
                        var reasons = {}, intro = null;
                        if (ex.ok) { reasons = ex.data.reasons; intro = ex.data.intro || null; if (ex.data.source === 'nvidia') trace.push('chat.trace.explain'); }
                        ctxRef.current = null;   // this request is answered
                        add({
                            role: 'assistant', type: 'plan', parsed: parsed,
                            intro: intro, reasons: reasons, items: plan.items, total: plan.total, leftover: plan.leftover,
                            budget: parsed.budget, trace: trace
                        });
                    });
                });
            });
        }

        // Always labeled (never an icon alone), in the corner where the thumb is, in every language.
        // Raised 76px: on the live site Netlify injects a badge (about 64px tall) in the bottom corner.
        var launcher = e('button', {
            onClick: function () { setOpen(!open); }, 'data-test': 'chat-launcher', 'aria-expanded': open, 'aria-controls': 'gw-chat',
            className: 'fixed bottom-[76px] end-4 md:end-6 z-40 items-center gap-2 min-h-[52px] px-5 rounded-full font-semibold text-[15px] press ' + (open ? 'hidden md:inline-flex' : 'inline-flex'),
            style: { backgroundColor: C.purpleDeep, color: C.paper, boxShadow: '0 6px 24px rgba(36,29,42,0.28)' }
        }, e(Icon, { name: open ? 'x' : 'sparkles', size: 18, style: { color: open ? C.paper : C.gold } }), open ? t('common.close') : t('chat.launcher'));

        if (!open) return launcher;

        var examples = [t('chat.ex1'), t('chat.ex2'), t('chat.ex3')];
        var panel = e('div', {
            id: 'gw-chat', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'gw-chat-title',
            className: 'fixed z-40 inset-x-0 bottom-0 top-16 md:top-auto md:inset-x-auto md:bottom-[140px] md:end-6 md:w-[420px] md:h-[min(640px,calc(100vh-210px))] flex flex-col md:rounded-xl border overflow-hidden',
            style: { backgroundColor: C.paper, borderColor: C.line, boxShadow: '0 24px 64px rgba(36,29,42,0.22)' }
        },
            e('div', { className: 'px-5 py-4 flex items-center gap-3 border-b', style: { borderColor: C.line } },
                e(Icon, { name: 'sparkles', size: 20, style: { color: C.goldText } }),
                e('div', { className: 'flex-1 min-w-0' },
                    e('h2', { id: 'gw-chat-title', className: 'font-display text-[20px] leading-tight' }, t('chat.title')),
                    e('div', { className: 'text-[12px] font-mono2', style: { color: C.inkSoft } }, t('chat.powered'))),
                e('button', { onClick: function () { setOpen(false); }, className: 'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md', 'aria-label': t('common.close'), style: { color: C.inkSoft } }, e(Icon, { name: 'x', size: 20 }))
            ),
            e('div', { className: 'flex-1 overflow-y-auto px-5 py-5 space-y-5', 'aria-live': 'polite' },
                msgs.map(function (m, i) {
                    var mine = m.role === 'user';
                    if (mine) return e('div', { key: i, className: 'flex justify-end' },
                        e('div', { className: 'rounded-2xl rounded-ee-sm px-4 py-2.5 max-w-[85%] text-[15px]', dir: 'auto', style: { backgroundColor: C.ink, color: C.paper } }, m.text));
                    return e('div', { key: i, className: 'border-s-2 ps-4', style: { borderColor: m.type === 'plan' ? C.purple : C.line } },
                        m.type === 'plan' ? e(PlanMessage, { msg: m }) : e('p', { className: 'text-[15px] leading-relaxed' }, m.key ? t(m.key) : m.text));
                }),
                msgs.length === 1 ? e('div', { className: 'flex flex-col items-start gap-2' },
                    examples.map(function (ex) {
                        return e('button', { key: ex, onClick: function () { send(ex); }, dir: 'auto', className: 'min-h-[44px] px-4 py-2 rounded-md border text-[14px] text-start press', style: { borderColor: C.field, color: C.ink } }, ex);
                    })
                ) : null,
                busy ? e('div', { className: 'text-[13px] font-mono2 flex items-center gap-2', role: 'status', style: { color: C.inkSoft } },
                    e('span', { className: 'w-2 h-2 rounded-full animate-pulse', style: { backgroundColor: C.gold } }), t(busy)) : null,
                e('div', { ref: endRef })
            ),
            e('form', {
                className: 'p-3 border-t flex gap-2', style: { borderColor: C.line },
                onSubmit: function (ev) { ev.preventDefault(); send(); }
            },
                e(TextField, {
                    ref: inputRef, value: input, onChange: function (ev) { setInput(ev.target.value); }, disabled: !!busy, dir: 'auto',
                    'aria-label': t('chat.inputPh'), placeholder: t('chat.inputPh'), className: 'flex-1'
                }),
                e('button', { type: 'submit', disabled: !!busy || !input.trim(), className: 'min-w-[48px] min-h-[44px] rounded-md flex items-center justify-center press disabled:opacity-40', style: { backgroundColor: C.purple, color: '#fff' }, 'aria-label': t('chat.send') },
                    e(Icon, { name: 'send', size: 18 }))
            )
        );
        return e(React.Fragment, null, panel, launcher);
    };
})();
