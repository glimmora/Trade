/**
 * Cloudflare Worker allow-list proxy.
 *
 * Purpose: some public market-data endpoints (notably Yahoo Finance)
 * block browser origins with CORS. This worker forwards GET requests to
 * an allow-list of upstream hosts only, with caching and rate-limit
 * handling. It is a dumb pipe on purpose:
 *
 * - Only HTTPS, only hosts in ALLOWED_HOSTS, only GET/HEAD/OPTIONS.
 * - No secrets are stored, forwarded, or logged by this worker. Upstream
 *   API keys, where required, are supplied by the client per request
 *   (query parameter) and are never persisted here. The key value is
 *   redacted from any error response.
 * - Per-IP rate limiting (in-memory, best-effort) + upstream 429/Retry-After
 *   propagation so clients back off instead of hammering the upstream.
 * - Short cache (5s for live data, 60s for daily data) via Cache API.
 * - No request body is forwarded; no cookies are set or read.
 */

const ALLOWED_HOSTS = new Set<string>([
  'api.binance.com',
  'api.bybit.com',
  'www.okx.com',
  'api.kraken.com',
  'api.exchange.coinbase.com',
  'api.gateio.ws',
  'api.twelvedata.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'stooq.com',
]);

const LIVE_CACHE_SECONDS = 5;
const DAILY_CACHE_SECONDS = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

interface RateBucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, RateBucket>();

function isRateLimited(clientIp: string, nowMs: number): boolean {
  const bucket = buckets.get(clientIp);
  if (bucket === undefined || nowMs - bucket.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    buckets.set(clientIp, { count: 1, windowStartMs: nowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function redactUrl(url: URL): string {
  const copy = new URL(url.toString());
  for (const key of [...copy.searchParams.keys()]) {
    if (/apikey|api_key|token|key/i.test(key)) {
      copy.searchParams.set(key, '[redacted]');
    }
  }
  return copy.toString();
}

function isDailyPath(pathname: string): boolean {
  return pathname.includes('/q/d/l/') || pathname.includes('interval=1d') || pathname.includes('interval=1D');
}

function cacheTtlSeconds(targetUrl: URL): number {
  return isDailyPath(targetUrl.pathname + targetUrl.search) ? DAILY_CACHE_SECONDS : LIVE_CACHE_SECONDS;
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-headers': 'accept, content-type',
          'access-control-max-age': '86400',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return errorResponse(405, 'Only GET and HEAD are allowed');
    }

    const clientIp = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (isRateLimited(clientIp, Date.now())) {
      return errorResponse(429, 'Rate limited by the proxy. Retry after 60 seconds.');
    }

    const targetParam = url.searchParams.get('url');
    if (targetParam === null || targetParam === '') {
      return errorResponse(400, 'Missing url parameter');
    }
    let targetUrl: URL;
    try {
      targetUrl = new URL(targetParam);
    } catch {
      return errorResponse(400, 'Invalid url parameter');
    }
    if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return errorResponse(403, 'Upstream host not allowed');
    }
    // Never proxy the worker itself or localhost.
    if (targetUrl.hostname === url.hostname) {
      return errorResponse(403, 'Upstream host not allowed');
    }

    const ttl = cacheTtlSeconds(targetUrl);
    const cacheKey = new Request(targetUrl.toString(), { method: 'GET' });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached !== undefined) {
      const headers = new Headers(cached.headers);
      headers.set('access-control-allow-origin', '*');
      headers.set('x-proxy-cache', 'HIT');
      return new Response(cached.body, { status: cached.status, headers });
    }

    let response: Response;
    try {
      response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: { accept: 'application/json, text/csv, */*' },
        cf: { cacheTtl: ttl, cacheEverything: false },
      });
    } catch {
      return errorResponse(502, `Upstream ${targetUrl.hostname} unreachable`);
    }

    // Propagate upstream rate limiting instead of masking it.
    if (response.status === 429) {
      const headers = new Headers();
      headers.set('content-type', 'application/json');
      headers.set('access-control-allow-origin', '*');
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter !== null) headers.set('Retry-After', retryAfter);
      return new Response(
        JSON.stringify({ error: `Upstream ${targetUrl.hostname} rate-limited the request` }),
        { status: 429, headers },
      );
    }

    const headers = new Headers(response.headers);
    headers.set('access-control-allow-origin', '*');
    headers.set('cache-control', `public, max-age=${ttl}`);
    headers.set('x-proxy-cache', 'MISS');
    // Strip headers that could leak upstream internals.
    headers.delete('set-cookie');
    headers.delete('cf-ray');

    const proxied = new Response(response.body, { status: response.status, headers });
    if (response.ok && request.method === 'GET') {
      // Cache in the background so a slow cache write never blocks the reply.
      ctx.waitUntil(cache.put(cacheKey, proxied.clone()));
    }
    return proxied;
  },
};
