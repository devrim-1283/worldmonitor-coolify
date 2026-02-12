/**
 * Temporal Baseline Anomaly Detection API
 * Stores and queries activity baselines using Welford's online algorithm
 * Backed by Upstash Redis for cross-user persistence
 *
 * GET ?type=military_flights&region=global&count=47 — check anomaly
 * POST { updates: [{ type, region, count }] } — batch update baselines
 */

import { Redis } from './_redis.js';

export const config = {
  runtime: 'edge',
};

const BASELINE_TTL = 7776000; // 90 days in seconds
const MIN_SAMPLES = 10;
const Z_THRESHOLD_LOW = 1.5;
const Z_THRESHOLD_MEDIUM = 2.0;
const Z_THRESHOLD_HIGH = 3.0;

const VALID_TYPES = ['military_flights', 'vessels', 'protests', 'news', 'ais_gaps', 'satellite_fires'];

// Lazy Redis init
let redis = null;
let redisInitFailed = false;
function getRedis() {
  if (redis) return redis;
  if (redisInitFailed) return null;

  if (process.env.REDIS_URL) {
    try {
      redis = new Redis();
    } catch (err) {
      console.warn('[TemporalBaseline] Redis init failed:', err.message);
      redisInitFailed = true;
      return null;
    }
  }
  return redis;
}

function makeKey(type, region, weekday, month) {
  return `baseline:${type}:${region}:${weekday}:${month}`;
}

function getSeverity(zScore) {
  if (zScore >= Z_THRESHOLD_HIGH) return 'critical';
  if (zScore >= Z_THRESHOLD_MEDIUM) return 'high';
  if (zScore >= Z_THRESHOLD_LOW) return 'medium';
  return 'normal';
}

export default async function handler(request) {
  const r = getRedis();
  if (!r) {
    return new Response(JSON.stringify({ error: 'Redis not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    if (request.method === 'GET') {
      return await handleGet(r, request);
    } else if (request.method === 'POST') {
      return await handlePost(r, request);
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[TemporalBaseline] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleGet(r, request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const region = searchParams.get('region') || 'global';
  const count = parseFloat(searchParams.get('count'));

  if (!type || !VALID_TYPES.includes(type) || isNaN(count)) {
    return json({ error: 'Missing or invalid params: type, count required' }, 400);
  }

  const now = new Date();
  const weekday = now.getUTCDay();
  const month = now.getUTCMonth() + 1;
  const key = makeKey(type, region, weekday, month);

  const baseline = await r.get(key);

  if (!baseline || baseline.sampleCount < MIN_SAMPLES) {
    return json({
      anomaly: null,
      learning: true,
      sampleCount: baseline?.sampleCount || 0,
      samplesNeeded: MIN_SAMPLES,
    });
  }

  const variance = Math.max(0, baseline.m2 / (baseline.sampleCount - 1));
  const stdDev = Math.sqrt(variance);
  const zScore = stdDev > 0 ? Math.abs((count - baseline.mean) / stdDev) : 0;
  const severity = getSeverity(zScore);
  const multiplier = baseline.mean > 0
    ? Math.round((count / baseline.mean) * 100) / 100
    : count > 0 ? 999 : 1;

  return json({
    anomaly: zScore >= Z_THRESHOLD_LOW ? {
      zScore: Math.round(zScore * 100) / 100,
      severity,
      multiplier,
    } : null,
    baseline: {
      mean: Math.round(baseline.mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      sampleCount: baseline.sampleCount,
    },
    learning: false,
  });
}

async function handlePost(r, request) {
  const body = await request.json();
  const updates = body?.updates;

  if (!Array.isArray(updates) || updates.length === 0) {
    return json({ error: 'Body must have updates array' }, 400);
  }

  // Cap batch size
  const batch = updates.slice(0, 20);
  const now = new Date();
  const weekday = now.getUTCDay();
  const month = now.getUTCMonth() + 1;

  // Read all existing baselines
  const keys = batch.map(u => makeKey(u.type, u.region || 'global', weekday, month));
  const existing = await r.mget(...keys);

  // Compute Welford updates and pipeline writes
  const pipeline = r.pipeline();
  let updated = 0;

  for (let i = 0; i < batch.length; i++) {
    const { type, region = 'global', count } = batch[i];
    if (!VALID_TYPES.includes(type) || typeof count !== 'number' || isNaN(count)) continue;

    const prev = existing[i] || { mean: 0, m2: 0, sampleCount: 0 };

    // Welford's online algorithm
    const n = prev.sampleCount + 1;
    const delta = count - prev.mean;
    const newMean = prev.mean + delta / n;
    const delta2 = count - newMean;
    const newM2 = prev.m2 + delta * delta2;

    pipeline.set(keys[i], {
      mean: newMean,
      m2: newM2,
      sampleCount: n,
      lastUpdated: now.toISOString(),
    }, { ex: BASELINE_TTL });

    updated++;
  }

  if (updated > 0) {
    await pipeline.exec();
  }

  return json({ updated });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
