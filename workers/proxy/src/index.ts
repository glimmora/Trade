// Cloudflare Worker allow-list proxy (stub).
// Only the hosts below are ever proxied. No secrets are stored or
// forwarded by this worker; upstream API keys, where required, are
// supplied by the client per request and never logged.
const ALLOWED_HOSTS = new Set<string>([
  'api.binance.com',
  'api.bybit.com',
  'www.okx.com',
  'api.kraken.com',
  'api.exchange.coinbase.com',
  'api.gateio.ws',
  'api.twelvedata.com',
  'query1.finance.yahoo.com',
  'stooq.com',
]);

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing url parameter', { status: 400 });
    }
    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid url parameter', { status: 400 });
    }
    if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return new Response('Upstream host not allowed', { status: 403 });
    }
    const response = await fetch(targetUrl.toString(), {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 5, cacheEverything: false },
    } as RequestInit);
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'public, max-age=5');
    headers.set('access-control-allow-origin', '*');
    return new Response(response.body, { status: response.status, headers });
  },
};
