/* Golden Wishes — motion helpers (Motion One from the CDN, window.Motion).
 * Principles: quick (180-320 ms for feedback, 600-900 ms for reveals), one ease-out curve, each thing moves once.
 * With prefers-reduced-motion, or if the library did not load, nothing moves and final states show at once.
 *   GW.motion.useReveal(ref)       children with [data-reveal] rise in, staggered, the first time they are on screen
 *   e(CountUp, { value, format })  number counting up when visible, then from the old to the new value
 *   GW.motion.pageIn(el)           short cross-fade between views
 */
window.GW = window.GW || {};

(function () {
    var EASE = [0.2, 0.7, 0.2, 1];
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function enabled() { return !!window.Motion && !(mq && mq.matches); }

    // Calls cb once, the first time el is at least `amount` visible.
    function onVisible(el, cb, amount) {
        if (!('IntersectionObserver' in window)) { cb(); return function () {}; }
        var io = new IntersectionObserver(function (entries) {
            if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); cb(); }
        }, { threshold: amount || 0.15 });
        io.observe(el);
        return function () { io.disconnect(); };
    }

    function reveal(container) {
        var items = [].slice.call(container.querySelectorAll('[data-reveal]:not([data-revealed])'));
        if (!items.length) return function () {};
        items.forEach(function (el) { el.setAttribute('data-revealed', ''); });
        if (!enabled()) return function () {};
        items.forEach(function (el) { el.style.opacity = '0'; });
        // Items already on screen together share one stagger; the rest reveal as they scroll in.
        var stops = items.map(function (el, i) {
            return onVisible(el, function () {
                window.Motion.animate(el, { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] },
                    { duration: 0.6, delay: Math.min(i, 8) * 0.04, ease: EASE });
            }, 0.1);
        });
        return function () { stops.forEach(function (s) { s(); }); };
    }

    // React hook: reveal [data-reveal] children of ref; re-runs when deps change (new rows after a filter).
    function useReveal(ref, deps) {
        React.useEffect(function () {
            if (!ref.current) return undefined;
            return reveal(ref.current);
        }, deps || []);
    }

    function pageIn(el) {
        if (!el || !enabled()) return;
        window.Motion.animate(el, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { duration: 0.28, ease: EASE });
    }

    // Number that counts up once when visible, then animates between values (e.g. after a donation).
    function CountUp(props) {
        var ref = React.useRef(null);
        var shown = React.useRef(null);
        var format = props.format || function (n) { return GW.i18n.fmtNumber(Math.round(n)); };
        React.useEffect(function () {
            var el = ref.current;
            if (!el) return undefined;
            var to = Number(props.value) || 0;
            var from = shown.current === null ? 0 : shown.current;
            function write(v) { el.textContent = format(v); }
            if (!enabled() || from === to) { shown.current = to; write(to); return undefined; }
            var controls = null;
            write(from);
            var stop = onVisible(el, function () {
                controls = window.Motion.animate(from, to, { duration: shown.current === null ? 0.9 : 0.6, ease: EASE, onUpdate: write });
                shown.current = to;
            }, 0.4);
            return function () { stop(); if (controls && controls.stop) controls.stop(); };
        }, [props.value, GW.i18n.lang]);
        return e('span', { ref: ref, className: 'num ' + (props.className || ''), 'aria-label': format(props.value) }, format(shown.current === null ? props.value : shown.current));
    }

    GW.motion = { enabled: enabled, onVisible: onVisible, reveal: reveal, useReveal: useReveal, pageIn: pageIn, EASE: EASE };
    GW.CountUp = CountUp;
})();
