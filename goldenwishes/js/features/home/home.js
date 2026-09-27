/* Golden Wishes — home page. Editorial layout: hero with the wish tree and a live ledger, then numbered sections.
 * Volunteer/partner forms are stored in the database (/api/forms).
 */
function HomePage(props) {
    var store = GW.useStore();
    var s7 = useState(false); var submitting = s7[0], setSubmitting = s7[1];
    var s9 = useState(false); var showVolunteerForm = s9[0], setShowVolunteerForm = s9[1];
    var s10 = useState({ fullName: '', email: '', phone: '', school: '', reason: '' }); var volunteerData = s10[0], setVolunteerData = s10[1];
    var s11 = useState(false); var showPartnerForm = s11[0], setShowPartnerForm = s11[1];
    var s12 = useState({ companyName: '', contactPerson: '', email: '', phone: '', partnershipType: '', message: '' }); var partnerData = s12[0], setPartnerData = s12[1];
    var pageRef = React.useRef(null);
    GW.motion.useReveal(pageRef);

    var offers = store.getOffers();
    var open = offers.filter(function (o) { return o.status === 'open'; });
    var fulfilled = offers.filter(function (o) { return o.status === 'funded'; }).length;
    var needed = open.reduce(function (s, o) { return s + store.remaining(o); }, 0);
    var partnerCount = Object.keys(offers.reduce(function (m, o) { if (o.verified_by) m[o.verified_by] = 1; return m; }, {})).length;

    function sendForm(kind, data, required, requiredMsg, thanksMsg, onDone) {
        if (required.some(function (k) { return !String(data[k] || '').trim(); })) { alert(requiredMsg); return; }
        setSubmitting(true);
        store.submitForm(kind, data).then(function (result) {
            setSubmitting(false);
            if (!result.ok) { alert(errorText(result)); return; }
            alert(thanksMsg);
            onDone();
        });
    }
    function handleVolunteerSubmit() {
        sendForm('volunteer', volunteerData, ['fullName', 'email', 'phone'], t('form.volRequired'), t('form.volThanks'), function () {
            setShowVolunteerForm(false);
            setVolunteerData({ fullName: '', email: '', phone: '', school: '', reason: '' });
        });
    }
    function handlePartnerSubmit() {
        sendForm('partner', partnerData, ['companyName', 'contactPerson', 'email', 'phone'], t('form.partnerRequired'), t('form.partnerThanks'), function () {
            setShowPartnerForm(false);
            setPartnerData({ companyName: '', contactPerson: '', email: '', phone: '', partnershipType: '', message: '' });
        });
    }
    function openChat() { window.dispatchEvent(new CustomEvent('gw:open-chat')); }

    /* ---- Hero: headline + wish tree (beside on desktop, above on phones), then the live ledger ---- */
    function Ledger(p) {
        return e('div', { 'data-reveal': '', className: 'py-6 md:py-0 md:pe-6 border-t md:border-t-0 md:border-s first:border-t-0 first:md:border-s-0 md:ps-6 first:md:ps-0', style: { borderColor: C.line } },
            e('div', { className: 'font-display text-[40px] md:text-[52px] leading-none', style: { color: p.color || C.ink } }, e(GW.CountUp, { value: p.value, format: p.format })),
            e('div', { className: 't-eyebrow mt-3', style: { color: C.inkSoft } }, p.label));
    }
    var heroEl = e('section', { className: 'wrap pt-10 md:pt-20 pb-16 md:pb-24' },
        e('div', { className: 'grid md:grid-cols-12 gap-6 md:gap-10 items-end' },
            e('div', { className: 'md:col-span-4 md:order-2 flex md:justify-end' },
                e(TreeHero, { className: 'w-28 md:w-full md:max-w-[250px]' })),
            e('div', { className: 'md:col-span-8 md:order-1' },
                e(Eyebrow, null, t('home.badge')),
                e('h1', { className: 't-display mb-8', style: { color: C.ink } },
                    t('home.h1a'), e('br'), e('span', { style: { color: C.purple } }, t('home.h1b'))),
                e('p', { className: 'font-display text-[22px] md:text-[26px] leading-snug mb-4 max-w-2xl', style: { color: C.ink } }, t('home.lede')),
                e('p', { className: 'text-[17px] leading-relaxed max-w-xl mb-10', style: { color: C.inkSoft } }, t('home.intro')),
                e('div', { className: 'flex flex-wrap gap-3' },
                    e(PrimaryButton, { onClick: function () { GW.router.goSection('wishes'); } }, t('home.browse'), e(Icon, { name: 'arrowRight', size: 16 })),
                    e(GhostButton, { onClick: openChat, style: { borderColor: C.purple, color: C.purple } }, e(Icon, { name: 'sparkles', size: 16 }), t('home.askAi'))
                )
            )
        ),
        e('div', { className: 'mt-16 md:mt-20 pt-8 border-t', style: { borderColor: C.ink } },
            e('div', { className: 't-eyebrow mb-6', style: { color: C.inkSoft } }, t('home.ledgerLabel')),
            e('div', { className: 'grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr]' },
                e(Ledger, { value: needed, format: function (n) { return formatMAD(Math.round(n)); }, label: t('home.ledgerNeeded'), color: C.purple }),
                e(Ledger, { value: open.length, label: t('home.ledgerOpen') }),
                e(Ledger, { value: fulfilled, label: t('home.ledgerFulfilled') }),
                e(Ledger, { value: partnerCount, label: t('home.ledgerPartners') })
            )
        )
    );

    /* ---- 01 How it works: a numbered sequence separated by rules ---- */
    var steps = [
        { n: '01', title: t('home.step1t'), desc: t('home.step1d') },
        { n: '02', title: t('home.step2t'), desc: t('home.step2d') },
        { n: '03', title: t('home.step3t'), desc: t('home.step3d') }
    ];
    var howEl = e('section', { id: 'how', className: 'wrap py-16 md:py-28' },
        e(SectionHead, { n: '01', eyebrow: t('home.ebHow'), title: t('home.howTitle') }),
        e('ol', { className: 'grid md:grid-cols-3 gap-x-10' },
            steps.map(function (s) {
                return e('li', { key: s.n, 'data-reveal': '', className: 'border-t pt-6 pb-10', style: { borderColor: C.ink } },
                    e('div', { className: 'font-mono2 num text-sm mb-6', style: { color: C.purple } }, s.n),
                    e('h3', { className: 't-h3 font-display mb-3' }, s.title),
                    e('p', { className: 'text-[16px] leading-relaxed max-w-sm', style: { color: C.inkSoft } }, s.desc));
            })
        )
    );

    /* ---- 02 Why this exists: asymmetric text columns ---- */
    var whyEl = e('section', { className: 'py-16 md:py-28', style: { backgroundColor: C.paperDeep } },
        e('div', { className: 'wrap grid md:grid-cols-12 gap-x-10 gap-y-12' },
            e('div', { className: 'md:col-span-4' },
                e(Eyebrow, { n: '02' }, t('home.ebWhy')),
                e('h2', { className: 't-h2 font-display' }, t('home.aboutTitle'))),
            e('div', { className: 'md:col-span-7 md:col-start-6 space-y-5 text-[17px] leading-relaxed', 'data-reveal': '', style: { color: C.ink } },
                e('p', null, t('home.about1')),
                e('p', { style: { color: C.inkSoft } }, t('home.about2'))),
            e('div', { className: 'md:col-span-4' },
                e('h3', { className: 't-h3 font-display' }, t('home.whoTitle'))),
            e('div', { className: 'md:col-span-7 md:col-start-6', 'data-reveal': '' },
                e('p', { className: 'text-[17px] leading-relaxed mb-6', style: { color: C.inkSoft } }, t('home.who')),
                e('div', { className: 'border-s-2 ps-5 py-1', style: { borderColor: C.purple } },
                    e('p', { className: 'text-[16px] leading-relaxed mb-2', style: { color: C.ink } }, t('home.whoContact')),
                    e('a', { href: '#/make-a-wish', className: 'inline-flex items-center gap-1.5 min-h-[44px] font-semibold link-draw', style: { color: C.purple } },
                        t('nav.submit'), e(Icon, { name: 'arrowRight', size: 16 }))))
        )
    );

    /* ---- 04 The money: dark band, two ways + where it goes ---- */
    var moneyEl = e('section', { id: 'trust', className: 'py-16 md:py-28', style: { backgroundColor: C.purpleDeep, color: C.paper } },
        e('div', { className: 'wrap grid md:grid-cols-12 gap-x-10 gap-y-12' },
            e('div', { className: 'md:col-span-6' },
                e(Eyebrow, { n: '04', color: 'rgba(251,246,236,0.75)' }, t('home.ebMoney')),
                e('h2', { className: 't-h2 font-display mb-5' }, t('home.waysTitle')),
                e('p', { className: 'text-[17px] leading-relaxed max-w-lg', style: { color: 'rgba(251,246,236,0.82)' } }, t('home.waysIntro'))),
            e('div', { className: 'md:col-span-5 md:col-start-8 space-y-8' },
                [['handshake', 'home.buyT', 'home.buyD'], ['heart', 'home.fundT', 'home.fundD']].map(function (w) {
                    return e('div', { key: w[1], 'data-reveal': '', className: 'flex gap-4 border-t pt-6', style: { borderColor: 'rgba(251,246,236,0.25)' } },
                        e(Icon, { name: w[0], size: 22, style: { color: C.gold, flexShrink: 0, marginTop: 3 } }),
                        e('div', null,
                            e('h3', { className: 't-h3 font-display mb-2' }, t(w[1])),
                            e('p', { className: 'text-[16px] leading-relaxed', style: { color: 'rgba(251,246,236,0.82)' } }, t(w[2]))));
                })),
            e('div', { className: 'md:col-span-12 grid md:grid-cols-12 gap-x-10 border-t pt-10 mt-4', style: { borderColor: 'rgba(251,246,236,0.25)' } },
                e('div', { className: 'md:col-span-4 t-eyebrow mb-4', style: { color: C.gold } }, t('home.moneyTitle')),
                e('div', { className: 'md:col-span-7 md:col-start-6 space-y-4 text-[17px] leading-relaxed', 'data-reveal': '' },
                    e('p', null, t('home.money1')),
                    e('p', { style: { color: 'rgba(251,246,236,0.82)' } }, t('home.money2'))))
        )
    );

    /* ---- 05 Get involved: two columns with rules ---- */
    var joinEl = e('section', { id: 'join', className: 'wrap py-16 md:py-28' },
        e(SectionHead, { n: '05', eyebrow: t('home.ebJoin'), title: t('home.joinTitle') }),
        e('div', { className: 'grid md:grid-cols-2 gap-x-10' },
            [{ icon: 'users', title: 'home.volTitle', desc: 'home.volDesc', cta: 'home.volCta', open: function () { setShowVolunteerForm(true); } },
             { icon: 'handshake', title: 'home.partnerTitle', desc: 'home.partnerDesc', cta: 'home.partnerCta', open: function () { setShowPartnerForm(true); } }].map(function (c) {
                return e('div', { key: c.title, 'data-reveal': '', className: 'border-t pt-8 pb-12', style: { borderColor: C.ink } },
                    e(Icon, { name: c.icon, size: 26, style: { color: C.purple, marginBottom: 20 } }),
                    e('h3', { className: 't-h3 font-display mb-3' }, t(c.title)),
                    e('p', { className: 'text-[16px] leading-relaxed mb-6 max-w-md', style: { color: C.inkSoft } }, t(c.desc)),
                    e(GhostButton, { onClick: c.open }, t(c.cta), e(Icon, { name: 'arrowRight', size: 16 })));
            })
        )
    );

    function formModal(title, onClose, children) {
        return e(Modal, { onClose: onClose },
            e('div', { className: 'flex justify-between items-start gap-4 mb-6' },
                e('h3', { className: 't-h3 font-display' }, title),
                e('button', { onClick: onClose, className: 'min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center', style: { color: C.inkSoft }, 'aria-label': t('common.close') }, e(Icon, { name: 'x', size: 20 }))
            ),
            e('div', { className: 'space-y-4' }, children)
        );
    }
    function field(data, setData, key) {
        return function (ev) { var o = Object.assign({}, data); o[key] = ev.target.value; setData(o); };
    }

    var volunteerModal = showVolunteerForm ? formModal(t('home.volTitle'), function () { setShowVolunteerForm(false); }, [
        e(TextField, { key: 'n', 'aria-label': t('form.fullName'), placeholder: t('form.fullName'), value: volunteerData.fullName, onChange: field(volunteerData, setVolunteerData, 'fullName') }),
        e(TextField, { key: 'e', 'aria-label': t('form.email'), placeholder: t('form.email'), type: 'email', value: volunteerData.email, onChange: field(volunteerData, setVolunteerData, 'email') }),
        e(TextField, { key: 'p', 'aria-label': t('form.phone'), placeholder: t('form.phone'), type: 'tel', value: volunteerData.phone, onChange: field(volunteerData, setVolunteerData, 'phone') }),
        e(TextField, { key: 's', 'aria-label': t('form.school'), placeholder: t('form.school'), value: volunteerData.school, onChange: field(volunteerData, setVolunteerData, 'school') }),
        e(TextArea, { key: 'r', 'aria-label': t('form.reason'), rows: 4, placeholder: t('form.reason'), value: volunteerData.reason, onChange: field(volunteerData, setVolunteerData, 'reason') }),
        e(PrimaryButton, { key: 'b', style: { width: '100%' }, disabled: submitting, onClick: handleVolunteerSubmit }, submitting ? t('form.submitting') : t('form.submitApp'))
    ]) : null;

    var partnerModal = showPartnerForm ? formModal(t('home.partnerTitle'), function () { setShowPartnerForm(false); }, [
        e(TextField, { key: 'o', 'aria-label': t('form.org'), placeholder: t('form.org'), value: partnerData.companyName, onChange: field(partnerData, setPartnerData, 'companyName') }),
        e(TextField, { key: 'c', 'aria-label': t('form.contact'), placeholder: t('form.contact'), value: partnerData.contactPerson, onChange: field(partnerData, setPartnerData, 'contactPerson') }),
        e(TextField, { key: 'e', 'aria-label': t('form.email'), placeholder: t('form.email'), type: 'email', value: partnerData.email, onChange: field(partnerData, setPartnerData, 'email') }),
        e(TextField, { key: 'p', 'aria-label': t('form.phone'), placeholder: t('form.phone'), type: 'tel', value: partnerData.phone, onChange: field(partnerData, setPartnerData, 'phone') }),
        e(Select, { key: 't', 'aria-label': t('form.ptype'), value: partnerData.partnershipType, onChange: field(partnerData, setPartnerData, 'partnershipType') },
            e('option', { value: '' }, t('form.ptype')),
            ['financial', 'inkind', 'corporate', 'media', 'misc'].map(function (k) { return e('option', { key: k, value: k }, t('form.ptype.' + k)); })
        ),
        e(TextArea, { key: 'm', 'aria-label': t('form.idea'), rows: 4, placeholder: t('form.idea'), value: partnerData.message, onChange: field(partnerData, setPartnerData, 'message') }),
        e(PrimaryButton, { key: 'b', style: { width: '100%' }, disabled: submitting, onClick: handlePartnerSubmit }, submitting ? t('form.submitting') : t('form.submitReq'))
    ]) : null;

    return e('div', { ref: pageRef },
        heroEl, howEl, whyEl,
        e('div', { id: 'wishes' }, e(GW.OfferList, { query: props.query, n: '03', eyebrow: t('home.ebWishes') })),
        moneyEl, joinEl, volunteerModal, partnerModal
    );
}
