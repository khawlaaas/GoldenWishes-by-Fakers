/* Golden Wishes — co-financing panel (feature 4): give any amount up to what is still needed.
 * The donation is inserted in the database; the trigger updates the wish (never this code).
 */
window.GW = window.GW || {};

GW.FundPanel = function FundPanel(props) {
    var offer = props.offer;
    var left = GW.store.remaining(offer);
    var s1 = useState(''); var amount = s1[0], setAmount = s1[1];
    var s2 = useState(''); var donor = s2[0], setDonor = s2[1];
    var s6 = useState(''); var email = s6[0], setEmail = s6[1];
    var s3 = useState(''); var error = s3[0], setError = s3[1];
    var s4 = useState(null); var thanks = s4[0], setThanks = s4[1];
    var s5 = useState(false); var showClaim = s5[0], setShowClaim = s5[1];
    var s7 = useState(false); var busy = s7[0], setBusy = s7[1];

    if (offer.status === 'funded') {
        return e('div', { className: 'border-t pt-5', role: 'status', style: { borderColor: C.line } },
            thanks ? e('p', { className: 'text-[16px] font-semibold mb-2', style: { color: C.goldText } }, t('fund.completed', { amount: formatMAD(thanks) })) : null,
            e('p', { className: 'text-[15px] leading-relaxed', style: { color: C.inkSoft } }, t('fund.fundedThanks')));
    }
    if (offer.status !== 'open') {
        return e('p', { className: 'border-t pt-5 text-[15px]', style: { borderColor: C.line, color: C.inkSoft } }, t('fund.pending'));
    }

    var presets = [50, 100, 250].filter(function (p) { return p < left; }).concat([left]);
    var num = Math.round(Number(amount) * 100) / 100;
    var valid = amount !== '' && isFinite(num) && num > 0 && num <= left && !busy;

    function submit(ev) {
        if (ev) ev.preventDefault();
        if (!valid) return;
        setError(''); setBusy(true);
        GW.store.contribute(offer.id, num, { name: donor, email: email }).then(function (r) {
            setBusy(false);
            if (!r.ok) { setError(errorText(r)); return; }
            setThanks(r.contribution.amount);
            setAmount('');
        });
    }
    function label(text, input) {
        return e('label', { className: 'block' }, e('span', { className: 't-eyebrow block mb-1.5', style: { color: C.inkSoft } }, text), input);
    }

    return e(React.Fragment, null, e('form', { className: 'space-y-5', onSubmit: submit },
        e('fieldset', null,
            e('legend', { className: 't-eyebrow mb-3', style: { color: C.inkSoft } }, t('fund.chipIn')),
            e('div', { className: 'flex flex-wrap gap-2' },
                presets.map(function (p) {
                    var active = String(p) === String(amount);
                    return e('button', {
                        key: p, type: 'button', 'aria-pressed': active, onClick: function () { setAmount(String(p)); setThanks(null); setError(''); },
                        className: 'min-h-[44px] px-4 rounded-md border text-[15px] font-mono2 num press',
                        style: active ? { backgroundColor: C.ink, color: C.paper, borderColor: C.ink } : { borderColor: C.field, color: C.ink, backgroundColor: 'transparent' }
                    }, p === left ? t('fund.all', { amount: formatMAD(p) }) : formatMAD(p));
                })
            )),
        label(t('fund.otherAmount', { amount: formatMAD(left) }),
            e(TextField, { 'data-test': 'amount', type: 'number', inputMode: 'decimal', min: 1, max: left, step: '0.01', value: amount, onChange: function (ev) { setAmount(ev.target.value); setThanks(null); setError(''); } })),
        amount !== '' && num > left ? e('p', { 'data-test': 'over-limit', role: 'alert', className: 'text-[14px]', style: { color: C.pinkText } }, t('fund.onlyLeft', { amount: formatMAD(left) })) : null,
        label(t('fund.name'), e(TextField, { value: donor, autoComplete: 'name', onChange: function (ev) { setDonor(ev.target.value); } })),
        label(t('fund.email'), e(TextField, { type: 'email', autoComplete: 'email', value: email, onChange: function (ev) { setEmail(ev.target.value); } })),
        error ? e('p', { role: 'alert', className: 'text-[14px] border-s-2 ps-3', style: { color: C.pinkText, borderColor: C.pinkText } }, error) : null,
        e(PrimaryButton, { type: 'submit', style: { width: '100%' }, disabled: !valid }, busy ? t('common.saving') : valid ? t('fund.fundN', { amount: formatMAD(num) }) : t('fund.fundThis')),
        thanks ? e('p', { role: 'status', className: 'text-[15px] flex items-center gap-2', style: { color: C.sageText } },
            e(Icon, { name: 'heart', size: 16 }), t('fund.thanks', { amount: formatMAD(thanks) })) : null,
        e('p', { className: 'text-[13px] leading-relaxed', style: { color: C.inkSoft } }, t('fund.demoNote')),
        e('button', { type: 'button', onClick: function () { setShowClaim(true); }, className: 'inline-flex items-center gap-1.5 min-h-[44px] text-[15px] font-semibold link-draw', style: { color: C.purple } },
            t('fund.takeWhole'), e(Icon, { name: 'arrowRight', size: 15 }))),
        showClaim ? e(ClaimModal, { offer: offer, onClose: function () { setShowClaim(false); } }) : null
    );
};
