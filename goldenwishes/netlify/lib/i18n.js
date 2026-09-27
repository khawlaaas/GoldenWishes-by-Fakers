/* Server-side translations: the same dictionaries as the browser (js/i18n). */
const { createT } = require('../../js/i18n/i18n.js');
const DICTS = { en: require('../../js/i18n/en.js'), fr: require('../../js/i18n/fr.js'), ar: require('../../js/i18n/ar.js') };

function translator(lang) {
    return createT(DICTS, DICTS[lang] ? lang : 'en').t;
}

module.exports = { translator, DICTS };
