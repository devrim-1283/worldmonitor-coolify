/**
 * Redis Compatibility Layer
 * Drop-in replacement for @upstash/redis that works with standard Redis (ioredis).
 * Mimics the Upstash REST API surface: .get(key), .set(key, value, { ex }) 
 * so existing Edge Functions don't need any changes.
 */

import IORedis from 'ioredis';

let client = null;
let initFailed = false;

function getClient() {
    if (client) return client;
    if (initFailed) return null;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        // Fallback to Upstash-style env vars for backward compat
        const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
        if (!upstashUrl) return null;
        // If only Upstash vars exist, return null — user should set REDIS_URL
        console.warn('[Redis] REDIS_URL not set. Set REDIS_URL for self-hosted Redis.');
        return null;
    }

    try {
        client = new IORedis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5) return null;
                return Math.min(times * 200, 2000);
            },
            lazyConnect: false,
        });
        client.on('error', (err) => {
            console.warn('[Redis] Connection error:', err.message);
        });
        client.on('connect', () => {
            console.log('[Redis] Connected successfully');
        });
    } catch (err) {
        console.warn('[Redis] Init failed:', err.message);
        initFailed = true;
        return null;
    }

    return client;
}

/**
 * Upstash-compatible Redis wrapper.
 * Usage: const redis = new Redis({ url, token }); // params ignored, uses REDIS_URL
 *        await redis.get(key) → parsed JSON or string
 *        await redis.set(key, value, { ex: ttlSeconds }) → 'OK'
 */
export class Redis {
    constructor(_opts) {
        // Options are ignored — we use REDIS_URL env var
        this._client = getClient();
    }

    async get(key) {
        if (!this._client) return null;
        try {
            const raw = await this._client.get(key);
            if (raw === null) return null;
            // Upstash auto-parses JSON, so we do the same
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
        } catch (err) {
            console.warn('[Redis] GET error:', err.message);
            return null;
        }
    }

    async set(key, value, options) {
        if (!this._client) return null;
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            if (options?.ex) {
                await this._client.set(key, serialized, 'EX', options.ex);
            } else {
                await this._client.set(key, serialized);
            }
            return 'OK';
        } catch (err) {
            console.warn('[Redis] SET error:', err.message);
            return null;
        }
    }

    async del(key) {
        if (!this._client) return 0;
        try {
            return await this._client.del(key);
        } catch (err) {
            console.warn('[Redis] DEL error:', err.message);
            return 0;
        }
    }

    async keys(pattern) {
        if (!this._client) return [];
        try {
            return await this._client.keys(pattern);
        } catch (err) {
            console.warn('[Redis] KEYS error:', err.message);
            return [];
        }
    }

    async mget(...keys) {
        if (!this._client) return keys.map(() => null);
        try {
            const flatKeys = keys.flat();
            const results = await this._client.mget(...flatKeys);
            return results.map(raw => {
                if (raw === null) return null;
                try { return JSON.parse(raw); } catch { return raw; }
            });
        } catch (err) {
            console.warn('[Redis] MGET error:', err.message);
            return keys.flat().map(() => null);
        }
    }

    /**
     * Pipeline support — mimics Upstash Redis pipeline.
     * Usage: const p = redis.pipeline(); p.set(k, v, { ex }); await p.exec();
     */
    pipeline() {
        const commands = [];
        const self = this;

        return {
            set(key, value, options) {
                commands.push({ op: 'set', key, value, options });
                return this; // chainable
            },
            get(key) {
                commands.push({ op: 'get', key });
                return this;
            },
            del(key) {
                commands.push({ op: 'del', key });
                return this;
            },
            async exec() {
                if (!self._client) return [];
                const pipeline = self._client.pipeline();
                for (const cmd of commands) {
                    if (cmd.op === 'set') {
                        const serialized = typeof cmd.value === 'string' ? cmd.value : JSON.stringify(cmd.value);
                        if (cmd.options?.ex) {
                            pipeline.set(cmd.key, serialized, 'EX', cmd.options.ex);
                        } else {
                            pipeline.set(cmd.key, serialized);
                        }
                    } else if (cmd.op === 'get') {
                        pipeline.get(cmd.key);
                    } else if (cmd.op === 'del') {
                        pipeline.del(cmd.key);
                    }
                }
                try {
                    const results = await pipeline.exec();
                    // Parse JSON for get results
                    return results.map(([err, val], i) => {
                        if (err) return null;
                        if (commands[i].op === 'get' && typeof val === 'string') {
                            try { return JSON.parse(val); } catch { return val; }
                        }
                        return val;
                    });
                } catch (err) {
                    console.warn('[Redis] Pipeline exec error:', err.message);
                    return [];
                }
            },
        };
    }
}

export default { Redis };
