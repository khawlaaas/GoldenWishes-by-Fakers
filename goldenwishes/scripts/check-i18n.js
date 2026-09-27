#!/usr/bin/env node
/* Checks the translations: node scripts/check-i18n.js
 * 1. en / fr / ar have the same keys (plural forms aside)
 * 2. every t('key') / tx('key') used in the code exists in en.js
 * 3. lists string literals in the views that look like user-facing text outside t() (to review by hand)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DICTS = { en: require('../js/i18n/en.js'), fr: require('../js/i18n/fr.js'), ar: require('../js/i18n/ar.js') };
const PLURAL = /\.(zero|one|two|few|many|other)$/;
const base = (d) => new Set(Object.keys(d).map((k) => k.replace(PLURAL, '')));

let problems = 0;
const en = base(DICTS.en);
for (const lang of ['fr', 'ar']) {
    const other = base(DICTS[lang]);
    for (const k of en) if (!other.has(k)) { console.log(`missing in ${lang}: ${k}`); problems++; }
    for (const k of other) if (!en.has(k)) { console.log(`extra in ${lang}: ${k}`); problems++; }
}

function walk(dir, out) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, out);
        else if (/\.(js|html)$/.test(f) && !/i18n[\\/](en|fr|ar)\.js$/.test(p) && !/seed-|embeddings/.test(f)) out.push(p);
    }
    return out;
}
const files = walk(path.join(ROOT, 'js'), []).concat(walk(path.join(ROOT, 'netlify'), []), [path.join(ROOT, 'index.html')]);
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const m of src.matchAll(/\b(?:t|tx|T)\('([a-z]+\.[\w.'-]*[\w'])'(?!\s*\+)/g)) {
        if (!en.has(m[1])) { console.log(`unknown key in ${rel}: ${m[1]}`); problems++; }
    }
    if ((/js[\\/](features|core)/.test(rel) || rel === 'index.html') && !/local-parse/.test(rel)) {
        src.split('\n').forEach((line, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(line) || /console\.|className:|require\(|RegExp|\/\^/.test(line) && !/e\(/.test(line)) return;
            for (const m of line.matchAll(/(?:^|[,(]\s*)'([A-Z][a-z][^']{3,})'/g)) {
                if (/^(Anonymous|Morocco|Casablanca|Golden Wishes|Content-Type|AbortError|Relay point|MAD)/.test(m[1])) continue;
                console.log(`possible hardcoded text ${rel}:${i + 1}: '${m[1].slice(0, 60)}'`);
            }
        });
    }
}
console.log(problems ? `${problems} problem(s)` : `OK: ${en.size} keys in en/fr/ar, every key used in the code exists`);
process.exit(problems ? 1 : 0);
