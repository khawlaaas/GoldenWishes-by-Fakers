#!/usr/bin/env node
/* Precompute embeddings of the open wishes ONCE (NVIDIA free tier is rate-limited).
 * Usage:  node scripts/embed-offers.js
 * Reads rag_text (built by the database trigger) from active_wishes_view, one batched NVIDIA call,
 * writes js/data/offer-embeddings.json keyed by wish id with a hash of the text.
 * Wishes approved later are embedded at approval time (/api/embed-wish, stored in Netlify Blobs).
 */
const fs = require('fs');
const path = require('path');
require('./env').loadEnv();
const { query } = require('../netlify/lib/db');
const { textHash } = require('../js/data/mapping.js');

const OUT = path.join(__dirname, '..', 'js/data/offer-embeddings.json');

async function main() {
    const key = process.env.NVIDIA_API_KEY;
    const model = process.env.NVIDIA_EMBED_MODEL || 'nvidia/nemotron-3-embed-1b';
    if (!key) throw new Error('NVIDIA_API_KEY missing: put it in .env');

    const rows = (await query('SELECT id, rag_text FROM active_wishes_view WHERE rag_text IS NOT NULL ORDER BY created_at')).rows;
    const res = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: rows.map((r) => r.rag_text), input_type: 'passage', encoding_format: 'float', truncate: 'END' }),
    });
    if (!res.ok) throw new Error('NVIDIA embeddings failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = (await res.json()).data.sort((a, b) => a.index - b.index);

    const out = { model, dim: data[0].embedding.length, generated_at: new Date().toISOString(), offers: {} };
    rows.forEach((r, i) => {
        out.offers[r.id] = { hash: textHash(r.rag_text), v: data[i].embedding.map((x) => Math.round(x * 10000) / 10000) };
    });
    fs.writeFileSync(OUT, JSON.stringify(out));
    console.log(`Wrote ${rows.length} vectors (dim ${out.dim}, ${model}) to js/data/offer-embeddings.json`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
