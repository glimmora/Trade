/**
 * Vercel Serverless Function: same-origin proxy for Yahoo Finance chart data.
 *
 * Browsers cannot call query1.finance.yahoo.com directly (CORS), so the
 * app calls this same-origin endpoint and this function forwards the
 * request server-side. It is a dumb pipe on purpose, mirroring the
 * allow-list rules of the Cloudflare proxy worker:
 *
 * - GET only (OPTIONS handled as a CORS preflight).
 * - Symbol allow-list: GC=F only (COMEX gold futures).
 * - Range and interval allow-lists; nothing else is forwarded.
 * - No credentials are stored, forwarded, or logged. No cookies are
 *   set, read, or passed through (set-cookie is stripped).
 * - Upstream 429 is propagated with Retry-After so clients back off
 *   instead of hammering the upstream.
 * - Short cache: 5s for intraday intervals, 60s for daily and slower.
 *
 * GC=F is a gold FUTURES contract — a proxy for spot gold, never spot.
 * The response JSON is passed through verbatim.
 *
 * No new dependencies. This file lives in apps/web/api (Vercel's
 * serverless-functions directory for this project, whose Root Directory
 * is apps/web); the web tsconfig includes only src and vite.config.ts,
 * so it is not typechecked by the app build, and it uses minimal
 * structural typing instead of importing a framework package that is
 * not installed.
 */

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';

const ALLOWED_SYMBOLS = new Set<string>(['GC=F']);
const ALLOWED_RANGES = new Set<string>([
  '1d',
  '5d',
  '1mo',
  '3mo',
  '6mo',
  '1y',
  '2y',
  '5y',
  'max',
]);
const ALLOWED_INTERVALS = new Set<string>([
  '1m',
  '2m',
  '5m',
  '15m',
  '30m',
  '60m',
  '90m',
  '1h',
  '1d',
  '5d',
  '1wk',
  '1mo',
  '3mo',
]);
const INTRADAY_INTERVALS = new Set<string>([
  '1m',
  '2m',
  '5m',
  '15m',
  '30m',
  '60m',
  '90m',
  '1h',
]);

/** Minimal structural shape of the request object the runtime provides. */
interface ProxyRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}

/** Minimal structural shape of the response object the runtime provides. */
interface ProxyResponse {
  status(code: number): ProxyResponse;
  setHeader(name: string, value: string | string[]): void;
  json(body: unknown): void;
  send(body: string): void;
  end(body?: string): void;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function corsHeaders(): Record<string, string> {
  return { 'access-control-allow-origin': '*' };
}

function jsonError(res: ProxyResponse, status: number, message: string): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', 'application/json');
  res.status(status).json({ error: message });
}

function isDigits(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export default async function handler(req: ProxyRequest, res: ProxyResponse): Promise<void> {
  // CORS preflight.
  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
    res.setHeader('access-control-allow-headers', 'accept, content-type');
    res.setHeader('access-control-max-age', '86400');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    jsonError(res, 405, 'Only GET is allowed');
    return;
  }

  const symbol = firstParam(req.query['symbol']);
  if (symbol === undefined || !ALLOWED_SYMBOLS.has(symbol)) {
    jsonError(res, 400, 'Only symbol GC=F is allowed');
    return;
  }
  const range = firstParam(req.query['range']);
  if (range === undefined || !ALLOWED_RANGES.has(range)) {
    jsonError(res, 400, 'Invalid or missing range parameter');
    return;
  }
  const interval = firstParam(req.query['interval']);
  if (interval === undefined || !ALLOWED_INTERVALS.has(interval)) {
    jsonError(res, 400, 'Invalid or missing interval parameter');
    return;
  }
  const period1 = firstParam(req.query['period1']);
  if (period1 !== undefined && !isDigits(period1)) {
    jsonError(res, 400, 'Invalid period1 parameter');
    return;
  }
  const period2 = firstParam(req.query['period2']);
  if (period2 !== undefined && !isDigits(period2)) {
    jsonError(res, 400, 'Invalid period2 parameter');
    return;
  }

  const upstreamParams = new URLSearchParams({ range, interval });
  if (period1 !== undefined) upstreamParams.set('period1', period1);
  if (period2 !== undefined) upstreamParams.set('period2', period2);
  const upstreamUrl = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?${upstreamParams.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        // Yahoo rejects requests without a browser-like User-Agent.
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        accept: 'application/json',
      },
    });
  } catch {
    jsonError(res, 502, 'Upstream query1.finance.yahoo.com unreachable');
    return;
  }

  // Propagate upstream rate limiting instead of masking it.
  if (upstream.status === 429) {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('content-type', 'application/json');
    const retryAfter = upstream.headers.get('Retry-After');
    if (retryAfter !== null) res.setHeader('Retry-After', retryAfter);
    res.status(429).json({ error: 'Upstream query1.finance.yahoo.com rate-limited the request' });
    return;
  }

  const ttlSeconds = INTRADAY_INTERVALS.has(interval) ? 5 : 60;
  const body = await upstream.text();
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json');
  res.setHeader('cache-control', `public, s-maxage=${String(ttlSeconds)}`);
  // set-cookie is never copied through: no upstream cookies reach the client.
  res.status(upstream.status).send(body);
}
