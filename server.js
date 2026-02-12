/**
 * World Monitor — Express API Server (Coolify/Docker)
 * 
 * Wraps all Vercel Edge Functions with a compatibility adapter.
 * Edge Functions use Web API Request/Response — this server converts
 * Express req/res ↔ Web API Request/Response transparently.
 * 
 * Includes: Server-level Redis cache, AIS WebSocket relay.
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';
import { Redis } from './api/_redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

// ── Redis cache singleton ─────────────────────────────────────────────
let cacheRedis = null;
let cacheRedisInitFailed = false;

function getCacheRedis() {
    if (cacheRedis) return cacheRedis;
    if (cacheRedisInitFailed) return null;
    if (!process.env.REDIS_URL) return null;
    try {
        cacheRedis = new Redis();
        console.log('[Cache] Redis connected for server-level caching');
        return cacheRedis;
    } catch (e) {
        cacheRedisInitFailed = true;
        console.warn('[Cache] Redis init failed:', e.message);
        return null;
    }
}

// ── Cache TTLs (seconds) per endpoint ─────────────────────────────────
const CACHE_TTLS = {
    '/api/earthquakes': 60,    // 1 min — real-time
    '/api/opensky': 60,    // 1 min — real-time aircraft
    '/api/faa-status': 120,   // 2 min
    '/api/ais-snapshot': 120,   // 2 min
    '/api/hackernews': 300,   // 5 min
    '/api/gdelt-doc': 300,   // 5 min
    '/api/gdelt-geo': 300,   // 5 min
    '/api/finnhub': 300,   // 5 min
    '/api/yahoo-finance': 300,   // 5 min
    '/api/stock-index': 300,   // 5 min
    '/api/coingecko': 300,   // 5 min
    '/api/polymarket': 300,   // 5 min
    '/api/stablecoin-markets': 300,   // 5 min
    '/api/cloudflare-outages': 300,   // 5 min
    '/api/rss-proxy': 300,   // 5 min
    '/api/theater-posture': 300,   // 5 min
    '/api/firms-fires': 600,   // 10 min
    '/api/risk-scores': 600,   // 10 min
    '/api/macro-signals': 600,   // 10 min
    '/api/nga-warnings': 600,   // 10 min
    '/api/etf-flows': 600,   // 10 min
    '/api/github-trending': 600,   // 10 min
    '/api/acled': 900,   // 15 min
    '/api/acled-conflict': 900,   // 15 min
    '/api/ucdp': 900,   // 15 min
    '/api/hapi': 900,   // 15 min
    '/api/temporal-baseline': 900,   // 15 min
    '/api/arxiv': 1800,   // 30 min
    '/api/tech-events': 1800,   // 30 min
    '/api/fred-data': 3600,   // 1 hour
    '/api/worldbank': 3600,   // 1 hour
    '/api/fwdstart': 1800,   // 30 min
};
const DEFAULT_TTL = 120; // 2 min default

// Skip caching for these (POST-based, user-specific, or utility)
const NO_CACHE = new Set([
    '/api/debug-env',
    '/api/cache-telemetry',
    '/api/service-status',
    '/api/classify-event',
    '/api/groq-summarize',
    '/api/openrouter-summarize',
    '/api/country-intel',
    '/api/og-story',
    '/api/story',
]);

function getCacheTTL(path) {
    if (CACHE_TTLS[path]) return CACHE_TTLS[path];
    // Prefix match for nested routes like /api/eia/*, /api/wingbits/*
    for (const [prefix, ttl] of Object.entries(CACHE_TTLS)) {
        if (path.startsWith(prefix)) return ttl;
    }
    return DEFAULT_TTL;
}

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: ['application/xml', 'text/xml', 'application/rss+xml'], limit: '5mb' }));

// ── Express → Web API Request adapter ─────────────────────────────────
function expressToWebRequest(req) {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const url = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const init = {
        method: req.method,
        headers,
    };

    // Attach body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body !== undefined) {
        if (typeof req.body === 'string') {
            init.body = req.body;
        } else if (Buffer.isBuffer(req.body)) {
            init.body = req.body;
        } else {
            init.body = JSON.stringify(req.body);
        }
    }

    return new Request(url, init);
}

// ── Wrap Edge Function handler with caching ───────────────────────────
function adaptEdgeHandler(handlerModule, routePath) {
    const handler = handlerModule.default || handlerModule;
    const shouldCache = !NO_CACHE.has(routePath);

    return async (req, res) => {
        try {
            // ── Cache check (GET only) ──
            if (req.method === 'GET' && shouldCache) {
                const redis = getCacheRedis();
                if (redis) {
                    try {
                        const cacheKey = `apicache:${req.originalUrl}`;
                        const cached = await redis.get(cacheKey);
                        if (cached) {
                            const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
                            res.status(data.s || 200);
                            if (data.h) {
                                Object.entries(data.h).forEach(([k, v]) => res.setHeader(k, v));
                            }
                            res.setHeader('x-cache', 'HIT');
                            res.send(Buffer.from(data.b, 'base64'));
                            return;
                        }
                    } catch (e) { /* cache miss or parse error, proceed */ }
                }
            }

            // ── Execute edge function ──
            const webRequest = expressToWebRequest(req);
            const webResponse = await handler(webRequest);

            // Read body once
            const bodyBuf = Buffer.from(await webResponse.arrayBuffer());

            // Collect headers
            const responseHeaders = {};
            webResponse.headers.forEach((value, key) => {
                if (key.toLowerCase() !== 'transfer-encoding') {
                    responseHeaders[key] = value;
                }
            });

            // ── Cache successful GET responses ──
            if (req.method === 'GET' && shouldCache && webResponse.status >= 200 && webResponse.status < 300 && bodyBuf.length > 0) {
                const redis = getCacheRedis();
                if (redis) {
                    try {
                        const ttl = getCacheTTL(req.path);
                        await redis.set(`apicache:${req.originalUrl}`, JSON.stringify({
                            s: webResponse.status,
                            h: responseHeaders,
                            b: bodyBuf.toString('base64'),
                        }), { ex: ttl });
                    } catch (e) { /* cache write fail, non-critical */ }
                }
            }

            // ── Send response ──
            res.status(webResponse.status);
            Object.entries(responseHeaders).forEach(([k, v]) => res.setHeader(k, v));
            res.setHeader('x-cache', 'MISS');
            if (bodyBuf.length > 0) {
                res.send(bodyBuf);
            } else {
                res.end();
            }
        } catch (err) {
            console.error(`[Server] Edge handler error on ${req.path}:`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error', details: err.message });
            }
        }
    };
}

// ── Auto-discover and register API routes ─────────────────────────────
async function registerApiRoutes() {
    const apiDir = join(__dirname, 'api');

    const skipPrefixes = ['_'];
    const skipFiles = ['_cors.js', '_upstash-cache.js', '_ip-rate-limit.js', '_cache-telemetry.js', '_redis.js'];

    async function scanDir(dir, routePrefix) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                if (entry === 'data') continue;
                await scanDir(fullPath, `${routePrefix}/${entry}`);
                continue;
            }

            if (!entry.endsWith('.js')) continue;
            if (skipPrefixes.some(p => entry.startsWith(p))) continue;
            if (skipFiles.includes(entry)) continue;

            let routePath;

            if (entry === '[[...path]].js' || entry === '[...path].js') {
                routePath = `${routePrefix}/*`;
            } else if (entry.startsWith('[') && entry.endsWith('].js')) {
                const paramName = entry.slice(1, -4);
                routePath = `${routePrefix}/:${paramName}`;
            } else {
                const name = entry.replace('.js', '');
                routePath = `${routePrefix}/${name}`;
            }

            try {
                const modulePath = `file:///${fullPath.replace(/\\/g, '/')}`;
                const mod = await import(modulePath);
                const handler = adaptEdgeHandler(mod, routePath);

                app.all(routePath, handler);
                console.log(`[Server] Registered: ${routePath}`);
            } catch (err) {
                console.error(`[Server] Failed to load ${fullPath}:`, err.message);
            }
        }
    }

    await scanDir(apiDir, '/api');
}

// ── AIS WebSocket Relay integration ───────────────────────────────────
function setupAisRelay() {
    const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
    const API_KEY = process.env.AISSTREAM_API_KEY;

    if (!API_KEY) {
        console.log('[Relay] AISSTREAM_API_KEY not set, WebSocket relay disabled');
        return;
    }

    const wss = new WebSocketServer({ server, path: '/ws' });
    let upstreamSocket = null;
    let clients = new Set();
    let messageCount = 0;

    function connectUpstream() {
        if (upstreamSocket?.readyState === WebSocket.OPEN ||
            upstreamSocket?.readyState === WebSocket.CONNECTING) return;

        console.log('[Relay] Connecting to aisstream.io...');
        const socket = new WebSocket(AISSTREAM_URL);
        upstreamSocket = socket;

        socket.on('open', () => {
            if (upstreamSocket !== socket) { socket.close(); return; }
            console.log('[Relay] Connected to aisstream.io');
            socket.send(JSON.stringify({
                APIKey: API_KEY,
                BoundingBoxes: [[[-90, -180], [90, 180]]],
                FilterMessageTypes: ['PositionReport'],
            }));
        });

        socket.on('message', (data) => {
            if (upstreamSocket !== socket) return;
            messageCount++;
            if (messageCount % 1000 === 0) {
                console.log(`[Relay] ${messageCount} messages, ${clients.size} clients`);
            }
            const message = data.toString();
            for (const client of clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            }
        });

        socket.on('close', () => {
            if (upstreamSocket === socket) {
                upstreamSocket = null;
                console.log('[Relay] Disconnected, reconnecting in 5s...');
                setTimeout(connectUpstream, 5000);
            }
        });

        socket.on('error', (err) => {
            console.error('[Relay] Upstream error:', err.message);
        });
    }

    wss.on('connection', (ws) => {
        console.log('[Relay] Client connected');
        clients.add(ws);
        connectUpstream();

        ws.on('close', () => clients.delete(ws));
        ws.on('error', (err) => console.error('[Relay] Client error:', err.message));
    });

    app.get('/ws/health', (req, res) => {
        res.json({
            status: 'ok',
            clients: clients.size,
            messages: messageCount,
            connected: upstreamSocket?.readyState === WebSocket.OPEN,
        });
    });

    console.log('[Relay] WebSocket relay enabled on /ws');
}

// ── Static file serving (production) ──────────────────────────────────
function setupStaticServing() {
    const distDir = join(__dirname, 'dist');

    if (existsSync(distDir)) {
        app.use('/assets', express.static(join(distDir, 'assets'), {
            maxAge: '1y',
            immutable: true,
        }));

        app.use(express.static(distDir, {
            maxAge: '1h',
            index: false,
        }));

        app.get('*', (req, res) => {
            if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
                return res.status(404).json({ error: 'Not found' });
            }
            res.sendFile(join(distDir, 'index.html'));
        });

        console.log('[Server] Serving static files from dist/');
    } else {
        console.log('[Server] No dist/ directory found. Run "npm run build" first for production.');
        app.get('/', (req, res) => {
            res.json({
                status: 'World Monitor API Server',
                message: 'Frontend not built. Run "npm run build" to generate static files.',
            });
        });
    }
}

// ── Start server ──────────────────────────────────────────────────────
async function start() {
    console.log('[Server] Starting World Monitor...');

    // Initialize cache Redis
    getCacheRedis();

    // 1. Register all API routes from Edge Functions
    await registerApiRoutes();

    // 2. Set up AIS WebSocket relay
    setupAisRelay();

    // 3. Serve static files (must be last — SPA catch-all)
    setupStaticServing();

    // 4. Start listening
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] World Monitor running on port ${PORT}`);
        console.log(`[Server] http://localhost:${PORT}`);
    });
}

start().catch(err => {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
});
