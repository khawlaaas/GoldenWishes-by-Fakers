/* Golden Wishes — shared UI: tokens, icons, marks, fields, buttons (moved from index.html). */
"use strict";
var e = React.createElement;
var useState = React.useState;


/* ---- Design tokens (Golden Wishes) ---- */
var C = {
    paper: '#FBF6EC',
    paperDeep: '#F5E9E2',
    ink: '#241D2A',
    inkSoft: '#6B5F71',
    purple: '#5B2C6E',
    purpleDeep: '#371C43',
    gold: '#C9962B',
    pink: '#C9587F',
    orchid: '#8C4F82',
    sage: '#5F7A52',
    line: '#E8DCE4',
    // Text-safe shades (4.5:1 or more on paper): gold, pink and sage above are for fills, bars and marks only.
    goldText: '#8A6414',
    pinkText: '#A8436A',
    sageText: '#4E6643',
    field: '#8E808F',   // input borders (3:1 on white)
};

/* ---- Minimal inline icon set (no external icon package needed) ---- */
var ICON_DEFS = {
    heart: [['path', { d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z' }]],
    users: [
        ['path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }],
        ['circle', { cx: 9, cy: 7, r: 4 }],
        ['path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' }],
        ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
    ],
    mapPin: [
        ['path', { d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z' }],
        ['circle', { cx: 12, cy: 10, r: 3 }],
    ],
    phone: [['path', { d: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .6 2.9a2 2 0 0 1-.5 2.1L7.9 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.5 2.9.6a2 2 0 0 1 1.8 2.1z' }]],
    mail: [
        ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
        ['path', { d: 'm22 6-10 7L2 6' }],
    ],
    upload: [
        ['path', { d: 'M12 3v13' }],
        ['path', { d: 'm7 8 5-5 5 5' }],
        ['path', { d: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' }],
    ],
    x: [
        ['path', { d: 'M18 6 6 18' }],
        ['path', { d: 'm6 6 12 12' }],
    ],
    arrowRight: [
        ['path', { d: 'M5 12h14' }],
        ['path', { d: 'm13 6 6 6-6 6' }],
    ],
    checkCircle: [
        ['circle', { cx: 12, cy: 12, r: 10 }],
        ['path', { d: 'm8 12 3 3 5-6' }],
    ],
    clock: [
        ['circle', { cx: 12, cy: 12, r: 10 }],
        ['path', { d: 'M12 6v6l4 2' }],
    ],
    graduationCap: [
        ['path', { d: 'M22 10 12 5 2 10l10 5 10-5z' }],
        ['path', { d: 'M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5' }],
    ],
    home: [
        ['path', { d: 'm3 11 9-8 9 8' }],
        ['path', { d: 'M5 10v10h14V10' }],
    ],
    palette: [
        ['circle', { cx: 9, cy: 9, r: 1.2, fill: 'currentColor', stroke: 'none' }],
        ['circle', { cx: 14, cy: 8, r: 1.2, fill: 'currentColor', stroke: 'none' }],
        ['circle', { cx: 16, cy: 13, r: 1.2, fill: 'currentColor', stroke: 'none' }],
        ['path', { d: 'M12 22a10 10 0 1 1 0-20c1 3 4 1 4 4s-3 2-3 5 4 2 4 5-3 4-5 6z' }],
    ],
    baby: [
        ['path', { d: 'M9 12h.01' }],
        ['path', { d: 'M15 12h.01' }],
        ['path', { d: 'M10 16c.8.6 1.8 1 2 1s1.2-.4 2-1' }],
        ['path', { d: 'M12 3c-3 0-5 2-5 5 0 1 .2 1.8.6 2.5C6.6 11 6 12.3 6 14a6 6 0 0 0 12 0c0-1.7-.6-3-1.6-3.5.4-.7.6-1.5.6-2.5 0-3-2-5-5-5z' }],
    ],
    handshake: [
        ['path', { d: 'm11 17 2 2a2.4 2.4 0 0 0 3.4-3.4l-3-3' }],
        ['path', { d: 'm14 14 3 3a2.4 2.4 0 0 0 3.4-3.4L15 8.3a2.4 2.4 0 0 0-3.4 0l-.9.9a2.4 2.4 0 0 1-3.4 0L4.6 6.6' }],
        ['path', { d: 'm6 12-2.6 2.6a2.4 2.4 0 1 0 3.4 3.4L9 15.8' }],
        ['path', { d: 'M12 6.6 9.9 4.5a2.4 2.4 0 0 0-3.4 0L3.9 6.9' }],
    ],
    heartPulse: [
        ['path', { d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z' }],
        ['path', { d: 'M3.5 12h4l2-3 3 6 2-3h6' }],
    ],
    tent: [
        ['path', { d: 'M3 20 12 4l9 16z' }],
        ['path', { d: 'M12 4v16' }],
        ['path', { d: 'm9 20 3-5 3 5' }],
    ],
    utensils: [
        ['path', { d: 'M3 2v7a3 3 0 0 0 6 0V2' }],
        ['path', { d: 'M6 2v20' }],
        ['path', { d: 'M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7' }],
    ],
    chat: [['path', { d: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-5.6A8 8 0 1 1 21 12z' }]],
    send: [
        ['path', { d: 'm22 2-7 20-4-9-9-4z' }],
        ['path', { d: 'M22 2 11 13' }],
    ],
    sparkles: [
        ['path', { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' }],
        ['path', { d: 'M19 17v4M17 19h4' }],
    ],
    alert: [
        ['path', { d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' }],
        ['path', { d: 'M12 9v4' }],
        ['path', { d: 'M12 17h.01' }],
    ],
    shield: [
        ['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
        ['path', { d: 'm9 12 2 2 4-4' }],
    ],
    shirt: [['path', { d: 'M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z' }]],
    laptop: [['rect', { x: 4, y: 4, width: 16, height: 11, rx: 1.5 }], ['path', { d: 'M2 19h20' }]],
    ball: [['circle', { cx: 12, cy: 12, r: 9.5 }], ['path', { d: 'M12 7.5l4.3 3.1-1.6 5h-5.4l-1.6-5z' }], ['path', { d: 'M12 2.5v5M21 10l-4.7.6M17.6 20l-2.9-4.4M6.4 20l2.9-4.4M3 10l4.7.6' }]],
    arrowLeft: [
        ['path', { d: 'M19 12H5' }],
        ['path', { d: 'm11 18-6-6 6-6' }],
    ],
};

var FLIP_RTL = { arrowRight: 1, arrowLeft: 1, send: 1 };
function Icon(props) {
    var name = props.name, size = props.size || 20, style = props.style, className = props.className;
    var shapes = ICON_DEFS[name];
    if (!shapes) return null;
    // Arrows point the other way in Arabic (right-to-left).
    if (FLIP_RTL[name]) className = (className ? className + ' ' : '') + 'flip-rtl';
    var common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: style, className: className, 'aria-hidden': 'true' };
    var children = shapes.map(function (s, i) {
        return e(s[0], Object.assign({ key: i }, s[1]));
    });
    return e.apply(null, ['svg', common].concat(children));
}

// Keys are the database categories (js/data/schema.js).
var CATEGORY_META = {
    education: { icon: 'graduationCap', color: C.purple },
    essentials: { icon: 'home', color: C.pinkText },
    creative: { icon: 'palette', color: C.goldText },
    family_care: { icon: 'baby', color: C.orchid },
    health: { icon: 'heartPulse', color: '#B04A4A' },
    clothing: { icon: 'shirt', color: '#7A5C8E' },
    technology: { icon: 'laptop', color: '#3F6477' },
    sport: { icon: 'ball', color: '#56652B' },
    shelter: { icon: 'tent', color: C.sageText },
    food: { icon: 'utensils', color: '#8A5320' },
};
function categoryLabel(key) { return t('cat.' + key); }
function regionLabel(region) { var k = 'region.' + region, v = t(k); return v === k ? region : v; }
function cityLabel(city) { var k = 'city.' + city, v = t(k); return v === k ? city : v; }
// "Relay point — partner association, Rabat" (DB text) in the current language.
function relayLabel(relay) {
    var m = String(relay || '').match(/^Relay point — partner association, (.+)$/);
    if (m) return t('relay.partner', { city: cityLabel(m[1]) });
    if (/^Relay point — to be assigned$/.test(relay || '')) return t('relay.tbd');
    return relay;
}
function countryLabel(code, name) { var k = 'country.' + code, v = t(k); return v === k ? name : v; }
// Error returned by GW.api / the store -> sentence in the current language.
function errorText(r) {
    if (!r) return t('chat.error');
    if (r.code === 'exceeds_remaining' && typeof r.left === 'number') return t('err.exceeds_remaining', { left: formatMAD(r.left) });
    if (r.code && t('err.' + r.code) !== 'err.' + r.code) return t('err.' + r.code);
    return r.error || t('chat.error');
}

// The wish mark: two dashed squares while the wish is open, a solid gold seal once it is funded.
// With `seal`, it plays the closing animation once (the fully funded moment).
function WishMark(props) {
    var filled = props.filled, color = filled ? C.gold : props.color, size = props.size || 40;
    var ref = React.useRef(null);
    React.useEffect(function () {
        if (!props.seal || !ref.current || !GW.motion || !GW.motion.enabled()) return;
        var rects = ref.current.querySelectorAll('rect');
        window.Motion.animate(ref.current, { transform: ['rotate(-45deg) scale(0.6)', 'rotate(0deg) scale(1.15)', 'rotate(0deg) scale(1)'] }, { duration: 0.9, ease: GW.motion.EASE });
        window.Motion.animate(rects, { fillOpacity: [0, 0.9] }, { duration: 0.6, delay: 0.3 });
    }, [props.seal]);
    function rectProps(rotate) {
        return {
            x: 8, y: 8, width: 24, height: 24,
            transform: rotate ? 'rotate(45 20 20)' : undefined,
            fill: filled ? C.gold : 'none',
            fillOpacity: filled ? 0.9 : 1,
            stroke: color,
            strokeWidth: '1.75',
            strokeDasharray: filled ? '0' : '3 2.5',
        };
    }
    return e('svg', { ref: ref, width: size, height: size, viewBox: '0 0 40 40', 'aria-hidden': 'true', className: 'shrink-0', style: { transformOrigin: '50% 50%' } },
        e('rect', rectProps(false)),
        e('rect', rectProps(true))
    );
}

function TreeMark(props) {
    var size = props.size || 28, trunkColor = props.trunkColor, foliageColor = props.foliageColor;
    return e('svg', { width: size, height: size, viewBox: '0 0 40 40', 'aria-hidden': 'true' },
        e('line', { x1: 20, y1: 24, x2: 20, y2: 35, stroke: trunkColor, strokeWidth: 2.5, strokeLinecap: 'round' }),
        e('circle', { cx: 20, cy: 15, r: 10, fill: foliageColor, opacity: 0.9 }),
        e('circle', { cx: 12, cy: 21, r: 7, fill: foliageColor, opacity: 0.65 }),
        e('circle', { cx: 28, cy: 21, r: 7, fill: foliageColor, opacity: 0.65 })
    );
}

function TreeHero(props) {
    return e('svg', { viewBox: '0 0 260 220', className: props && props.className || 'w-full max-w-[220px] mx-auto', 'aria-hidden': 'true' },
        e('path', { d: 'M123 140 L137 140 L133 205 L127 205 Z', fill: C.gold, opacity: 0.9 }),
        e('circle', { cx: 130, cy: 88, r: 66, fill: C.purple, opacity: 0.9 }),
        e('circle', { cx: 82, cy: 112, r: 42, fill: C.pink, opacity: 0.55 }),
        e('circle', { cx: 178, cy: 112, r: 42, fill: C.gold, opacity: 0.45 }),
        e('circle', { cx: 130, cy: 52, r: 38, fill: C.pink, opacity: 0.3 }),
        e('line', { x1: 88, y1: 140, x2: 88, y2: 160, stroke: C.gold, strokeWidth: 1.5 }),
        e('circle', { cx: 88, cy: 166, r: 7, fill: C.paper, stroke: C.gold, strokeWidth: 2 }),
        e('line', { x1: 130, y1: 146, x2: 130, y2: 170, stroke: C.pink, strokeWidth: 1.5 }),
        e('circle', { cx: 130, cy: 176, r: 7, fill: C.paper, stroke: C.pink, strokeWidth: 2 }),
        e('line', { x1: 172, y1: 140, x2: 172, y2: 158, stroke: C.gold, strokeWidth: 1.5 }),
        e('circle', { cx: 172, cy: 164, r: 7, fill: C.paper, stroke: C.gold, strokeWidth: 2 })
    );
}

var FIELD_CLASS = 'w-full min-h-[44px] px-4 py-3 rounded-md border font-body text-[15px] transition-colors';
var FIELD_STYLE = { borderColor: C.field, backgroundColor: '#fff', color: C.ink };
var TextField = React.forwardRef(function TextField(props, ref) {
    return e('input', Object.assign({}, props, { ref: ref, className: FIELD_CLASS + ' ' + (props.className || ''), style: Object.assign({}, FIELD_STYLE, props.style) }));
});
function TextArea(props) {
    return e('textarea', Object.assign({}, props, { className: FIELD_CLASS + ' ' + (props.className || ''), style: Object.assign({}, FIELD_STYLE, props.style) }));
}
function Select(props) {
    return e('select', Object.assign({}, props, { className: FIELD_CLASS + ' ' + (props.className || ''), style: Object.assign({}, FIELD_STYLE, props.style) }));
}

// Buttons: 44px minimum height, press feedback, focus ring from index.html (:focus-visible).
function buttonProps(props, base, style) {
    var rest = Object.assign({}, props);
    delete rest.children;
    rest.className = base + ' ' + (props.className || '');
    rest.style = Object.assign({}, style, props.style);
    return rest;
}
var BTN = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-md font-body font-semibold text-[15px] press transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
function PrimaryButton(props) {
    return e('button', buttonProps(props, BTN, { backgroundColor: C.purple, color: '#fff' }), props.children);
}
function GhostButton(props) {
    return e('button', buttonProps(props, BTN + ' border', { borderColor: C.field, color: C.ink, backgroundColor: 'transparent' }), props.children);
}

// Small numbered label above a section title: "01 — Open wishes".
function Eyebrow(props) {
    return e('div', { className: 't-eyebrow flex items-center gap-3 mb-4', style: { color: props.color || C.inkSoft } },
        props.n ? e('span', { className: 'num' }, props.n) : null,
        props.n ? e('span', { className: 'h-px w-8', style: { backgroundColor: 'currentColor', opacity: 0.5 } }) : null,
        e('span', null, props.children));
}
function SectionHead(props) {
    return e('header', { className: 'mb-10 md:mb-14 max-w-3xl' },
        e(Eyebrow, { n: props.n, color: props.eyebrowColor }, props.eyebrow),
        e(props.as || 'h2', { className: 't-h2 font-display', style: props.titleColor ? { color: props.titleColor } : null }, props.title),
        props.lede ? e('p', { className: 'mt-4 text-[17px] leading-relaxed max-w-2xl', style: { color: props.ledeColor || C.inkSoft } }, props.lede) : null
    );
}

/* ---- Shared layout + small widgets (used by several features) ---- */
// Amounts follow the current language: 1,234.50 MAD / 1.234,50 DH / 1.234,50 درهم
function formatAmount(n) { return GW.i18n.fmtNumber(n); }
function formatMAD(n) { return GW.i18n.fmtMoney(n); }

function ProgressBar(props) {
    var raised = props.raised || 0, total = props.total || 1, color = props.color || C.purple;
    var pct = Math.max(0, Math.min(100, Math.round((raised / total) * 100)));
    var ref = React.useRef(null);
    var s = useState(!GW.motion || !GW.motion.enabled()); var seen = s[0], setSeen = s[1];
    React.useEffect(function () {
        if (seen || !ref.current) return undefined;
        return GW.motion.onVisible(ref.current, function () { setSeen(true); }, 0.5);
    }, []);
    return e('div', { className: props.className || '' },
        e('div', { ref: ref, className: 'rounded-full overflow-hidden ' + (props.thin ? 'h-1' : 'h-1.5'), style: { backgroundColor: C.line }, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': t('progress.raised', { amount: formatMAD(raised) }) },
            e('div', { className: 'h-full rounded-full bar-fill', style: { width: (seen ? pct : 0) + '%', backgroundColor: pct >= 100 && !props.plain ? C.gold : color } })
        ),
        props.showLabel === false ? null : e('div', { className: 'flex justify-between text-xs font-mono2 mt-2 num', style: { color: C.inkSoft } },
            e('span', null, t('progress.raised', { amount: formatMAD(raised) })),
            e('span', null, GW.i18n.fmtNumber(pct) + '%')
        )
    );
}

// DB urgency: low = 1, medium = 3, high = 4, critical = 5 (js/data/mapping.js).
function urgencyLabel(u) { return t('urgency.' + u); }
function UrgencyBadge(props) {
    var u = props.urgency || 1;
    var color = u >= 5 ? '#B03A3A' : u >= 4 ? C.pinkText : u >= 3 ? C.goldText : C.sageText;
    return e('span', { className: 'inline-flex items-center gap-1.5 text-[11px] font-mono2 uppercase tracking-wide', style: { color: color }, title: t('urgency.title', { n: u }) },
        e('span', { className: 'flex gap-0.5', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(function (i) {
            return e('span', { key: i, className: 'w-1 h-2.5 rounded-sm', style: { backgroundColor: color, opacity: i <= u ? 1 : 0.2 } });
        })),
        t('urgency.badge', { label: urgencyLabel(u), n: u })
    );
}

function LangSwitcher() {
    var lang = GW.useLang();
    return e('div', { className: 'flex items-center', role: 'group', 'aria-label': t('lang.label') },
        GW.i18n.LANGS.map(function (l) {
            var active = l === lang;
            return e('button', {
                key: l, onClick: function () { GW.i18n.setLang(l); }, lang: l, 'aria-pressed': active, title: t('lang.' + l),
                className: 'min-w-[44px] min-h-[44px] px-2 text-xs font-semibold font-mono2 transition-colors',
                style: { color: active ? C.ink : C.inkSoft, textDecoration: active ? 'underline' : 'none', textUnderlineOffset: '6px', textDecorationThickness: '2px' }
            }, l === 'ar' ? 'ع' : l.toUpperCase());
        })
    );
}

var NAV = [
    { key: 'nav.wishes', short: 'nav.wishes', hash: '#/', path: '/', section: 'wishes' },
    { key: 'nav.needs', short: 'nav.needsShort', hash: '#/needs', path: '/needs' },
    { key: 'nav.news', short: 'nav.news', hash: '#/news', path: '/news' },
    { key: 'nav.submit', short: 'nav.submitShort', hash: '#/make-a-wish', path: '/make-a-wish' },
    { key: 'nav.review', short: 'nav.review', hash: '#/review', path: '/review' }
];

function Header(props) {
    var path = props.path || '/';
    function link(item, short) {
        var active = path === item.path;
        return e('a', {
            key: item.hash, href: item.hash, 'aria-current': active ? 'page' : undefined,
            onClick: item.section ? function (ev) { ev.preventDefault(); GW.router.goSection(item.section); } : undefined,
            className: 'inline-flex items-center min-h-[44px] whitespace-nowrap link-draw',
            style: { color: active ? C.ink : C.inkSoft, fontWeight: active ? 600 : 500 }
        }, t(short ? item.short : item.key));
    }
    return e('header', { className: 'sticky top-0 z-40 border-b', style: { backgroundColor: 'rgba(251,246,236,0.94)', borderColor: C.line, backdropFilter: 'blur(8px)' } },
        e('div', { className: 'wrap h-16 flex items-center justify-between gap-6' },
            e('a', { href: '#/', className: 'flex items-center gap-2 min-h-[44px]', 'aria-label': 'Golden Wishes' },
                e(TreeMark, { size: 28, trunkColor: C.gold, foliageColor: C.purple }),
                e('span', { className: 'font-display text-[19px] tracking-tight whitespace-nowrap', style: { fontWeight: 600 } }, 'Golden Wishes')
            ),
            e('nav', { className: 'hidden lg:flex items-center gap-7 text-[15px]', 'aria-label': 'Main' }, NAV.map(function (item) { return link(item, false); })),
            e(LangSwitcher)
        ),
        // Phones and tablets: the same links in a scrollable row.
        e('nav', { className: 'lg:hidden wrap flex gap-6 overflow-x-auto text-[15px] -mt-2', 'aria-label': 'Main' }, NAV.map(function (item) { return link(item, true); }))
    );
}

function Footer() {
    return e('footer', { className: 'mt-8 border-t', style: { borderColor: C.line } },
        e('div', { className: 'wrap py-12 grid gap-8 md:grid-cols-12 items-start' },
            e('div', { className: 'md:col-span-6 flex items-start gap-3' },
                e(TreeMark, { size: 28, trunkColor: C.gold, foliageColor: C.purple }),
                e('div', null,
                    e('div', { className: 'font-display text-xl', style: { fontWeight: 600 } }, 'Golden Wishes'),
                    e('p', { className: 'text-sm mt-1 max-w-sm', style: { color: C.inkSoft } }, t('footer.tagline'))
                )
            ),
            e('nav', { className: 'md:col-span-6 flex flex-wrap md:justify-end gap-x-6 text-[15px]', 'aria-label': 'Footer' },
                NAV.slice(1).map(function (item) {
                    return e('a', { key: item.hash, href: item.hash, className: 'inline-flex items-center min-h-[44px] link-draw', style: { color: C.inkSoft } }, t(item.key));
                })
            )
        )
    );
}

function Modal(props) {
    React.useEffect(function () {
        function onKey(ev) { if (ev.key === 'Escape' && props.onClose) props.onClose(); }
        window.addEventListener('keydown', onKey);
        return function () { window.removeEventListener('keydown', onKey); };
    }, []);
    return e('div', { className: 'fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4', style: { backgroundColor: 'rgba(36,29,42,0.55)' }, onClick: props.onClose },
        e('div', { className: 'rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto', style: { backgroundColor: C.paper }, onClick: function (ev) { ev.stopPropagation(); }, role: 'dialog', 'aria-modal': 'true' },
            props.children
        )
    );
}

// Standard page frame: numbered label, title aligned to the start, then content.
function PageShell(props) {
    return e('section', { className: 'wrap py-12 md:py-20' },
        props.title ? e(SectionHead, { as: 'h1', n: props.n, eyebrow: props.eyebrow, title: props.title, lede: props.subtitle }) : null,
        props.children
    );
}
