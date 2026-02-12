import { Redis } from './_redis.js';

let redis = null;
let redisInitFailed = false;

export function getRedis() {
  if (redis) return redis;
  if (redisInitFailed) return null;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    redis = new Redis();
  } catch (error) {
    redisInitFailed = true;
    console.warn('[Cache] Redis init failed:', error.message);
  }

  return redis;
}

export async function getCachedJson(key) {
  const redisClient = getRedis();
  if (!redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.warn('[Cache] Read failed:', error.message);
    return null;
  }
}

export async function setCachedJson(key, value, ttlSeconds) {
  const redisClient = getRedis();
  if (!redisClient) return false;
  try {
    await redisClient.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.warn('[Cache] Write failed:', error.message);
    return false;
  }
}

export function hashString(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
