/* Golden Wishes — budget allocation (feature 6). Plain JS: the AI never does money math.
 * Strategy: walk the ranked offers and fully complete the ones whose remaining need fits the
 * budget (a finished wish is worth more than many half-funded ones); put any leftover into the
 * best remaining match as a partial contribution. At most `maxOffers` offers.
 * Computed in cents, so a wish needing 394.31 MAD can be completed exactly.
 * Invariants (checked below): sum <= budget, each amount <= that offer's remaining need.
 */
window.GW = window.GW || {};

GW.allocate = function allocate(ranked, budget, maxOffers) {
    maxOffers = maxOffers || 3;
    var budgetC = Math.floor(Number(budget)) * 100;
    if (!ranked.length || !(budgetC > 0)) return { items: [], total: 0, leftover: budgetC > 0 ? budgetC / 100 : 0 };

    function needC(o) { return Math.round((o.total_price - o.amount_raised) * 100); }

    // Only consider reasonably relevant offers (close to the best score).
    var top = ranked[0].score;
    var candidates = ranked.filter(function (r, i) { return i < 6 && r.score >= top * 0.6; });

    var left = budgetC;
    var items = [];
    var used = {};

    // Pass 1: complete whole wishes, best match first.
    candidates.forEach(function (r) {
        if (items.length >= maxOffers) return;
        var need = needC(r.offer);
        if (need > 0 && need <= left) {
            items.push({ offer: r.offer, cents: need, completes: true, score: r.score, method: r.method });
            used[r.offer.id] = true;
            left -= need;
        }
    });

    // Pass 2: leftover (whole MAD) goes to the best match not yet used (partial).
    var leftWhole = Math.floor(left / 100) * 100;
    if (leftWhole > 0 && items.length < maxOffers) {
        var next = candidates.filter(function (r) { return !used[r.offer.id]; })[0];
        if (next) {
            var need2 = needC(next.offer);
            var amt = Math.min(leftWhole, need2);
            items.push({ offer: next.offer, cents: amt, completes: amt === need2, score: next.score, method: next.method });
            left -= amt;
        }
    }

    // Keep the ranking order for display.
    items.sort(function (a, b) { return b.score - a.score; });

    var totalC = items.reduce(function (s, it) { return s + it.cents; }, 0);
    var ok = totalC <= budgetC && items.every(function (it) {
        return Number.isInteger(it.cents) && it.cents > 0 && it.cents <= needC(it.offer);
    });
    if (!ok) { console.error('allocate: invariant broken', items); return { items: [], total: 0, leftover: budgetC / 100 }; }
    items.forEach(function (it) { it.amount = it.cents / 100; delete it.cents; });
    return { items: items, total: totalC / 100, leftover: (budgetC - totalC) / 100 };
};
