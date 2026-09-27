/* Postgres access for the Netlify Functions. The ONLY place that opens a DB connection.
 * One small pool per function instance, reused across warm invocations.
 * DATABASE_URL (gw_app user, pooled host, SSL) lives in .env / Netlify env vars: never log it.
 */
const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set on the server.');
    if (!pool) {
        // sslmode in the URL would override the ssl object below: strip it, SSL is always on here.
        const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
        pool = new Pool({
            connectionString: url,
            ssl: { rejectUnauthorized: true },
            max: 3,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 8000,
        });
        pool.on('error', (err) => console.error('pg pool error:', err.message));
    }
    return pool;
}

function query(text, params) {
    return getPool().query(text, params);
}

// Run fn(client) inside BEGIN/COMMIT, ROLLBACK on error.
async function tx(fn) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { query, tx };
