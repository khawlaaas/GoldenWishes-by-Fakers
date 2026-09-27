#!/usr/bin/env node
/* Translate every wish and news item into French and Arabic ONCE, stored in the translations columns.
 * Usage:  node scripts/translate-content.js            (skips what is already translated: safe to re-run)
 *         node scripts/translate-content.js --limit 2  (try on a few items first)
 * One NVIDIA call per item and language, spaced out for the free-tier rate limit (~40 requests/min).
 */
require('./env').loadEnv();
const { query } = require('../netlify/lib/db');
const { isDone, translateRow, saveTranslation } = require('../netlify/lib/translate');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

async function main() {
    if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY missing: put it in .env');
    const wishes = (await query(`SELECT id, title, description, story_context, translations FROM wishes
                                  WHERE status NOT IN ('rejected', 'expired') ORDER BY created_at`)).rows.map((r) => ({ kind: 'wish', row: r }));
    const news = (await query('SELECT id, title, summary, translations FROM news_items ORDER BY published_on DESC')).rows.map((r) => ({ kind: 'news', row: r }));
    const jobs = [];
    for (const item of wishes.concat(news)) for (const lang of ['fr', 'ar']) if (!isDone(item.row, item.kind, lang)) jobs.push(Object.assign({ lang }, item));
    console.log(`${jobs.length} translations to do (${wishes.length} wishes, ${news.length} news items, fr + ar)`);

    let done = 0, failed = 0;
    for (const job of jobs.slice(0, LIMIT)) {
        const started = Date.now();
        let r = await translateRow(job.kind, job.row, job.lang, { budgetMs: 60000, callTimeoutMs: 30000 });
        if (!r.ok && r.code === 'ai_busy') { console.log('  rate limited, waiting 30 s'); await sleep(30000); r = await translateRow(job.kind, job.row, job.lang, { budgetMs: 60000, callTimeoutMs: 30000 }); }
        if (r.ok) {
            await saveTranslation(job.kind, job.row.id, job.lang, r.value);
            done++;
            console.log(`  ok  ${job.kind} ${job.lang} ${String(Date.now() - started).padStart(5)} ms  ${job.row.title.slice(0, 40)} -> ${r.value.title.slice(0, 40)}`);
        } else {
            failed++;
            console.log(`  FAIL ${job.kind} ${job.lang} ${job.row.title.slice(0, 40)}: ${r.error}`);
        }
        await sleep(1600);
    }
    console.log(`Done: ${done} saved, ${failed} failed. Re-run to retry the failed ones.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
