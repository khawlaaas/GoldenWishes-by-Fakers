/* Golden Wishes — tiny hash router. Routes look like "#/path?key=value". */
window.GW = window.GW || {};

(function () {
    function parseHash() {
        var h = (location.hash || '').replace(/^#/, '') || '/';
        var qi = h.indexOf('?');
        var path = qi >= 0 ? h.slice(0, qi) : h;
        var params = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
        var query = {};
        params.forEach(function (v, k) { if (v !== '') query[k] = v; });
        return { path: path || '/', query: query };
    }

    function buildHash(path, query) {
        var params = new URLSearchParams();
        Object.keys(query || {}).forEach(function (k) {
            var v = query[k];
            if (v !== undefined && v !== null && v !== '') params.set(k, v);
        });
        var qs = params.toString();
        return '#' + path + (qs ? '?' + qs : '');
    }

    function navigate(path, query) {
        location.hash = buildHash(path, query);
    }

    // Scroll to a section of the home page, navigating home first if needed.
    function goSection(id) {
        var onHome = parseHash().path === '/';
        if (!onHome) navigate('/');
        setTimeout(function () {
            var el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, onHome ? 0 : 80);
    }

    function useRoute() {
        var s = React.useState(parseHash()); var route = s[0], setRoute = s[1];
        React.useEffect(function () {
            function onChange() { setRoute(parseHash()); }
            window.addEventListener('hashchange', onChange);
            return function () { window.removeEventListener('hashchange', onChange); };
        }, []);
        return route;
    }

    GW.router = { parseHash: parseHash, buildHash: buildHash, navigate: navigate, goSection: goSection, useRoute: useRoute };
})();
