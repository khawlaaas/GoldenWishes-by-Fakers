/* Golden Wishes — calls to our own Netlify Functions (/api/*). Never talks to NVIDIA or the database directly:
 * the keys only live on the server. Always resolves to { ok: true, data } or { ok: false, error, status, data }.
 */
window.GW = window.GW || {};

(function () {
    function request(path, body, opts) {
        opts = opts || {};
        var timeoutMs = opts.timeoutMs || 20000;
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
        return fetch('/api/' + path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: ctrl ? ctrl.signal : undefined
        }).then(function (res) {
            return res.text().then(function (text) {
                var json = null;
                try { json = JSON.parse(text); } catch (err) { /* not JSON */ }
                if (!res.ok || !json || json.ok === false) {
                    return { ok: false, status: res.status, data: json, code: (json && json.code) || 'server', error: (json && json.error) || ('The server answered ' + res.status + '.') };
                }
                return { ok: true, data: json };
            });
        }).catch(function (err) {
            var timeout = err && err.name === 'AbortError';
            return { ok: false, status: 0, code: timeout ? 'timeout' : 'network', error: timeout ? 'The server took too long to answer.' : 'Could not reach the server.' };
        }).finally(function () { if (timer) clearTimeout(timer); });
    }

    GW.api = {
        post: function (path, body, opts) { return request(path, body || {}, opts); },
        get: function (path, opts) { return request(path, undefined, opts); }
    };
})();
