import { Redis } from './_redis.js';

export const config = {
  runtime: 'edge',
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const CACHE_TTL_SECONDS = 86400;
const CACHE_VERSION = 'v1';

let redis = null;
let redisInitFailed = false;
function getRedis() {
  if (redis) return redis;
  if (redisInitFailed) return null;
  if (process.env.REDIS_URL) {
    try {
      redis = new Redis();
    } catch (err) {
      console.warn('[Classify] Redis init failed:', err.message);
      redisInitFailed = true;
      return null;
    }
  }
  return redis;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const VALID_LEVELS = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_CATEGORIES = [
  'conflict', 'protest', 'disaster', 'diplomatic', 'economic',
  'terrorism', 'cyber', 'health', 'environmental', 'military',
  'crime', 'infrastructure', 'tech', 'general',
];

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ fallback: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const title = url.searchParams.get('title');
  const variant = url.searchParams.get('variant') || 'full';

  if (!title) {
    return new Response(JSON.stringify({ error: 'title param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cacheKey = `classify:${CACHE_VERSION}:${hashString(title.toLowerCase() + ':' + variant)}`;

  try {
    const redisClient = getRedis();
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached && typeof cached === 'object' && cached.level) {
          return new Response(JSON.stringify({
            level: cached.level,
            category: cached.category,
            confidence: 0.9,
            source: 'llm',
            cached: true,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.warn('[Classify] Cache read error:', e.message);
      }
    }

    const isTech = variant === 'tech';
    const systemPrompt = `You classify news headlines into threat level and category. Return ONLY valid JSON, no other text.

Levels: critical, high, medium, low, info
Categories: conflict, protest, disaster, diplomatic, economic, terrorism, cyber, health, environmental, military, crime, infrastructure, tech, general

${isTech ? 'Focus: technology, startups, AI, cybersecurity. Most tech news is "low" or "info" unless it involves outages, breaches, or major disruptions.' : 'Focus: geopolitical events, conflicts, disasters, diplomacy. Classify by real-world severity and impact.'}

Return: {"level":"...","category":"..."}`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: title },
        ],
        temperature: 0,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      console.error('[Classify] Groq error:', response.status);
      return new Response(JSON.stringify({ fallback: true }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[Classify] Invalid JSON from LLM:', raw);
      return new Response(JSON.stringify({ fallback: true }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const level = VALID_LEVELS.includes(parsed.level) ? parsed.level : null;
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : null;
    if (!level || !category) {
      return new Response(JSON.stringify({ fallback: true }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (redisClient) {
      try {
        await redisClient.set(cacheKey, { level, category, timestamp: Date.now() }, { ex: CACHE_TTL_SECONDS });
      } catch (e) {
        console.warn('[Classify] Cache write error:', e.message);
      }
    }

    return new Response(JSON.stringify({
      level,
      category,
      confidence: 0.9,
      source: 'llm',
      cached: false,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('[Classify] Error:', error.message);
    return new Response(JSON.stringify({ fallback: true }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
