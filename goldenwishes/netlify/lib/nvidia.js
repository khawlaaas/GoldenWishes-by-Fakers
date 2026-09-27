/* Shared helpers for the AI functions: NVIDIA calls, JSON parsing, responses, demo fallback.
 * The API key is read from process.env and never returned to the browser.
 */
const BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
const DEFAULT_EMBED_MODEL = 'nvidia/nemotron-3-embed-1b';
// Used once if the main chat model answers 503 "overloaded".
const DEFAULT_CHAT_FALLBACK = 'nvidia/nemotron-3.5-lightning-30b-a3b';

function config() {
    return {
        hasKey: !!process.env.NVIDIA_API_KEY,
        chatModel: process.env.NVIDIA_CHAT_MODEL || DEFAULT_CHAT_MODEL,
        chatFallbackModel: process.env.NVIDIA_CHAT_MODEL_FALLBACK || DEFAULT_CHAT_FALLBACK,
        embedModel: process.env.NVIDIA_EMBED_MODEL || DEFAULT_EMBED_MODEL,
        demoFallback: String(process.env.DEMO_FALLBACK || '').toLowerCase() === 'true',
    };
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(body),
    };
}

// code: short machine-readable reason, translated in the browser (js/i18n, keys "err.<code>").
function fail(statusCode, error, code) {
    return json(statusCode, code ? { ok: false, error, code } : { ok: false, error });
}

function readBody(event) {
    if (event.httpMethod !== 'POST') return { error: 'Use POST.' };
    try {
        const body = JSON.parse(event.body || '{}');
        if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object.' };
        return { body };
    } catch (err) {
        return { error: 'Body is not valid JSON.' };
    }
}

async function nvidiaPost(path, payload, timeoutMs) {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) return { ok: false, code: 'ai_error', error: 'NVIDIA_API_KEY is not set on the server.' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    try {
        const res = await fetch(BASE_URL + path, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        const text = await res.text();
        if (!res.ok) {
            console.error('NVIDIA error', res.status, text.slice(0, 300));
            if (res.status === 429) return { ok: false, code: 'ai_busy', error: 'The AI is busy (rate limit). Please try again in a minute.' };
            return { ok: false, status: res.status, code: 'ai_error', error: 'The AI service returned an error (' + res.status + ').' };
        }
        return { ok: true, data: JSON.parse(text) };
    } catch (err) {
        console.error('NVIDIA call failed', err && err.message);
        const timeout = err && err.name === 'AbortError';
        return { ok: false, code: timeout ? 'ai_timeout' : 'ai_error', error: timeout ? 'The AI took too long to answer.' : 'Could not reach the AI service.' };
    } finally {
        clearTimeout(timer);
    }
}

// Pull the first {...} block out of a model reply and parse it.
function extractJSON(text) {
    if (typeof text !== 'string') return null;
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (err) { return null; }
}

/* One chat completion that must return JSON. `validate(obj)` returns the cleaned object or null.
 * If the reply is not valid JSON, retry once with a stricter reminder, only if there is time left
 * (Netlify functions are short-lived).
 */
async function chatJSON({ system, user, maxTokens, validate, budgetMs, callTimeoutMs, model: forcedModel }) {
    const started = Date.now();
    const budget = budgetMs || 9000;
    const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
    let model = forcedModel || config().chatModel;
    for (let attempt = 0; attempt < 2; attempt++) {
        const left = budget - (Date.now() - started);
        if (attempt > 0 && left < 3500) break;
        const r = await nvidiaPost('/chat/completions', {
            model,
            messages,
            temperature: 0.2,
            max_tokens: maxTokens || 400,
            // Nemotron 3 models "think out loud" by default: turn it off for fast, clean JSON.
            chat_template_kwargs: { enable_thinking: false },
        }, Math.min(left, callTimeoutMs || 8000));
        if (!r.ok) {
            // Main model overloaded: try the lighter backup model once.
            if (r.status === 503 && attempt === 0 && model !== config().chatFallbackModel) {
                console.warn('Chat model overloaded, retrying with ' + config().chatFallbackModel);
                model = config().chatFallbackModel;
                continue;
            }
            return r;
        }
        const content = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message && r.data.choices[0].message.content;
        const parsed = extractJSON(content);
        const valid = parsed ? validate(parsed) : null;
        if (valid) return { ok: true, value: valid };
        console.warn('Invalid JSON from model (attempt ' + (attempt + 1) + '):', String(content).slice(0, 200));
        messages.push({ role: 'assistant', content: String(content || '') });
        messages.push({ role: 'user', content: 'That was not valid. Reply with ONLY the JSON object, exactly in the requested format, nothing else.' });
    }
    return { ok: false, code: 'ai_invalid', error: 'The AI answer could not be understood. Please try again.' };
}

async function embed(texts, inputType) {
    const r = await nvidiaPost('/embeddings', {
        model: config().embedModel,
        input: texts,
        input_type: inputType,
        encoding_format: 'float',
        truncate: 'END',
    }, 8000);
    if (!r.ok) return r;
    const vectors = (r.data.data || []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (vectors.length !== texts.length) return { ok: false, error: 'Unexpected embeddings answer.' };
    return { ok: true, vectors };
}

module.exports = { config, json, fail, readBody, chatJSON, embed, extractJSON };
