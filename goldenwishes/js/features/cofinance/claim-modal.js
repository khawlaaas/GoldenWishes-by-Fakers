/* Golden Wishes — "Take on the whole wish" modal.
 * Two ways: fund everything that is still needed, or buy the item and drop it at the wish's relay point.
 * Both are recorded as one donation of the remaining amount (the database trigger marks the wish funded).
 */
function ClaimModal(props) {
    var offer = props.offer;
    var amountDue = GW.store.remaining(offer);
    var s1 = useState('options'); var step = s1[0], setStep = s1[1];
    var s2 = useState({ fullName: '', email: '', phone: '' }); var form = s2[0], setForm = s2[1];
    var s3 = useState(false); var done = s3[0], setDone = s3[1];
    var s4 = useState(false); var submitting = s4[0], setSubmitting = s4[1];
    var s5 = useState(''); var error = s5[0], setError = s5[1];

    var closeModal = props.onClose;
    var meta = CATEGORY_META[offer.category] || { color: C.purple };
    function set(k, v) { var o = Object.assign({}, form); o[k] = v; setForm(o); }

    function confirm() {
        setSubmitting(true); setError('');
        var donor = { name: form.fullName, email: form.email, phone: form.phone,
            message: step === 'buy' ? t('claim.inKindNote') : '' };
        GW.store.contribute(offer.id, amountDue, donor).then(function (r) {
            setSubmitting(false);
            if (!r.ok) { setError(errorText(r)); return; }
            setDone(true);
        });
    }

    var needsContact = step === 'buy';
    var canSubmit = form.fullName.trim() && (!needsContact || (form.phone.trim() && form.email.trim())) && !submitting;

    return e(Modal, { onClose: closeModal },
        e('div', { className: 'flex justify-between items-start mb-2' },
            e(WishMark, { filled: done, color: meta.color, size: 34 }),
            e('button', { onClick: closeModal, style: { color: C.inkSoft }, 'aria-label': t('common.close') }, e(Icon, { name: 'x', size: 20 }))
        ),
        !done ? e(React.Fragment, null,
            e('h3', { className: 'font-display text-2xl mb-2' }, offer.title),
            e('p', { className: 'text-sm mb-4', style: { color: C.inkSoft } }, offer.description),
            e('div', { className: 'font-mono2 text-lg mb-6' }, formatMAD(amountDue),
                amountDue < offer.total_price ? e('span', { className: 'text-xs ms-2', style: { color: C.inkSoft } }, t('claim.stillNeeded')) : null)
        ) : null,
        error ? e('div', { className: 'text-sm mb-4 p-3 rounded-md', style: { backgroundColor: '#FBE9EE', color: C.pink } }, error) : null,
        (!done && step === 'options') ? e('div', { className: 'space-y-3' },
            e(PrimaryButton, { style: { width: '100%' }, onClick: function () { setStep('fund'); } }, t('claim.fundFull')),
            e(PrimaryButton, { style: { width: '100%', backgroundColor: C.pink }, onClick: function () { setStep('buy'); } }, t('claim.buy')),
            e(GhostButton, { style: { width: '100%' }, onClick: closeModal }, t('common.cancel'))
        ) : null,
        (!done && step !== 'options') ? e('div', { className: 'space-y-4' },
            step === 'buy' ? e('div', { className: 'flex items-start gap-3 p-4 rounded-lg', style: { backgroundColor: C.paperDeep } },
                e(Icon, { name: 'clock', size: 20, style: { color: C.purpleDeep, flexShrink: 0, marginTop: 2 } }),
                e('p', { className: 'text-sm', style: { color: C.inkSoft } },
                    t('claim.dropNote', { place: relayLabel(offer.relay_point) || t('claim.partnerOrg') }))
            ) : null,
            e(TextField, { placeholder: t('form.fullName'), value: form.fullName, onChange: function (ev) { set('fullName', ev.target.value); } }),
            e(TextField, { placeholder: needsContact ? t('claim.emailRequired') : t('claim.emailOptional'), type: 'email', value: form.email, onChange: function (ev) { set('email', ev.target.value); } }),
            needsContact ? e(TextField, { placeholder: t('form.phone'), type: 'tel', value: form.phone, onChange: function (ev) { set('phone', ev.target.value); } }) : null,
            e(PrimaryButton, { style: { width: '100%' }, disabled: !canSubmit, onClick: confirm }, submitting ? t('common.saving') : t('claim.confirm', { amount: formatMAD(amountDue) })),
            e(GhostButton, { style: { width: '100%' }, onClick: function () { setStep('options'); setError(''); } }, t('common.back'))
        ) : null,
        done ? e('div', { className: 'text-center py-6' },
            e('h3', { className: 'font-display text-2xl mb-3' }, t('claim.doneTitle')),
            e('p', { className: 'text-sm', style: { color: C.inkSoft } },
                step === 'buy'
                    ? t('claim.doneBuy')
                    : t('claim.doneFund')),
            e(GhostButton, { style: { marginTop: 20 }, onClick: closeModal }, t('common.close'))
        ) : null
    );
}
