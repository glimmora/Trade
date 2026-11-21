import { useEffect, useRef, useState } from 'react';
import { SYMBOLS, type ProviderId } from '@trade/core';
import { createAdapter, providersForSymbol } from '@trade/providers';
import type { Ticker } from '@trade/providers';
import { providerMeta } from '../lib/providers';
import { useApp } from '../store/state';

const POLL_MS = 5000;
const TWELVEDATA_KEY_STORAGE_KEY = 'trade:twelvedata-key';
const OANDA_TOKEN_STORAGE_KEY = 'trade:oanda-token';
const OANDA_ACCOUNT_ID_STORAGE_KEY = 'trade:oanda-account-id';

/**
 * Providers whose tickers can only be reached via the proxy worker, which
 * is not deployed — their browser requests would fail on CORS, so they are
 * never used here. Yahoo is not listed: it goes through the same-origin
 * Vercel function at /api/yahoo.
 */
const PROXY_ONLY_PROVIDERS: readonly ProviderId[] = ['stooq'];

interface RowPlan {
  provider: ProviderId;
  /** Twelve Data key, only set when the plan's provider needs one. */
  key: string | undefined;
  /** OANDA token, only set when the plan's provider is OANDA. */
  oandaToken: string | undefined;
  /** OANDA account id, only set when the plan's provider is OANDA and one is stored. */
  oandaAccountId: string | undefined;
}

function readTwelveDataKey(): string | undefined {
  try {
    const stored = window.localStorage.getItem(TWELVEDATA_KEY_STORAGE_KEY);
    return stored !== null && stored.trim() !== '' ? stored : undefined;
  } catch {
    // Storage unavailable (private mode, quota): treat as "no key".
    return undefined;
  }
}

function readOandaToken(): string | undefined {
  try {
    const stored = window.localStorage.getItem(OANDA_TOKEN_STORAGE_KEY);
    return stored !== null && stored.trim() !== '' ? stored : undefined;
  } catch {
    // Storage unavailable (private mode, quota): treat as "no token".
    return undefined;
  }
}

function readOandaAccountId(): string | undefined {
  try {
    const stored = window.localStorage.getItem(OANDA_ACCOUNT_ID_STORAGE_KEY);
    return stored !== null && stored.trim() !== '' ? stored : undefined;
  } catch {
    // Storage unavailable (private mode, quota): treat as "no account id".
    return undefined;
  }
}

/**
 * First verified provider for a symbol that can serve a ticker from the
 * browser without a user key. Twelve Data is used only when its key is
 * stored; OANDA is used only when its token is stored; proxy-only
 * providers are skipped outright. Yahoo is keyless and served by the
 * same-origin /api/yahoo function, so it qualifies. Returns null when no
 * provider qualifies — that row stays '—' rather than showing a fake price.
 */
function resolveRowPlan(symbolId: string): RowPlan | null {
  const key = readTwelveDataKey();
  const oandaToken = readOandaToken();
  const oandaAccountId = readOandaAccountId();
  for (const providerId of providersForSymbol(symbolId, true)) {
    if (PROXY_ONLY_PROVIDERS.includes(providerId)) continue;
    if (providerId === 'twelvedata' && key === undefined) continue;
    if (providerId === 'oanda' && oandaToken === undefined) continue;
    return {
      provider: providerId,
      key: providerId === 'twelvedata' ? key : undefined,
      oandaToken: providerId === 'oanda' ? oandaToken : undefined,
      oandaAccountId: providerId === 'oanda' ? oandaAccountId : undefined,
    };
  }
  return null;
}

function formatChange(change24hPct: number | undefined): string {
  if (change24hPct === undefined || !Number.isFinite(change24hPct)) return '—';
  const sign = change24hPct >= 0 ? '+' : '';
  return `${sign}${change24hPct.toFixed(2)}%`;
}

/**
 * Watchlist with live prices. Each row polls its own ticker (REST
 * getTicker, no websockets) on one shared 5s interval. Prices are never
 * faked: a row shows '—' while loading or when no provider can serve it,
 * and a failed poll keeps the last real price instead of blanking it.
 * The store's lastPrice is deliberately not reused — it only ever holds
 * the active symbol's price.
 */
export function Watchlist(): JSX.Element {
  const { state, translate, connection, setSymbol } = useApp();
  const connecting = connection === 'connecting' || connection === 'offline';
  const [tickers, setTickers] = useState<Readonly<Record<string, Ticker>>>({});
  const [plans, setPlans] = useState<Readonly<Record<string, RowPlan | null>>>({});
  // Per-symbol request sequence: a late response from an older poll must
  // never overwrite a newer ticker.
  const seqRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    const poll = async (): Promise<void> => {
      // Re-resolve every round so a key added in Settings takes effect
      // without a remount.
      const resolved: Record<string, RowPlan | null> = {};
      for (const symbol of SYMBOLS) {
        resolved[symbol.id] = resolveRowPlan(symbol.id);
      }
      if (mounted) setPlans(resolved);

      await Promise.allSettled(
        SYMBOLS.map(async (symbol) => {
          const plan = resolved[symbol.id];
          if (plan === null || plan === undefined) return;
          const seq = (seqRef.current[symbol.id] ?? 0) + 1;
          seqRef.current[symbol.id] = seq;
          try {
            const options =
              plan.provider === 'oanda' && plan.oandaToken !== undefined
                ? {
                    keys: {
                      oanda: plan.oandaToken,
                      ...(plan.oandaAccountId === undefined
                        ? {}
                        : { oandaAccountId: plan.oandaAccountId }),
                    },
                  }
                : plan.key === undefined
                  ? undefined
                  : { keys: { twelvedata: plan.key } };
            const adapter = createAdapter(plan.provider, options);
            const ticker = await adapter.getTicker(symbol.id);
            if (!mounted || seqRef.current[symbol.id] !== seq) return;
            if (!Number.isFinite(ticker.price)) return;
            setTickers((prev) => ({ ...prev, [symbol.id]: ticker }));
          } catch {
            // Transient poll failure: keep the last real price (or '—'
            // when none has arrived yet). Never invent a value.
          }
        }),
      );
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="sidebar-section" aria-label={translate('watchlist')}>
      <div className="sidebar-section-header">
        <h3>{translate('watchlist')}</h3>
        <span className="connection-status" data-status={connection}>
          {connecting ? translate('connecting') : translate(connection)}
        </span>
      </div>
      <p className="watchlist-note">{translate('watchlistNote')}</p>
      <ul className="watchlist">
        {SYMBOLS.map((symbol) => {
          const active = state.symbol === symbol.id;
          const ticker = tickers[symbol.id];
          const plan = plans[symbol.id];
          return (
            <li key={symbol.id}>
              <button
                type="button"
                className="watchlist-row"
                aria-pressed={active}
                onClick={() => {
                  setSymbol(symbol.id);
                }}
              >
                <span className="watchlist-symbol">
                  <strong>{symbol.id}</strong>
                  <span className="watchlist-provider">
                    {plan !== null && plan !== undefined
                      ? providerMeta(plan.provider).label
                      : '—'}
                  </span>
                </span>
                <span className="watchlist-price">
                  {ticker !== undefined ? ticker.price.toFixed(symbol.precision) : '—'}
                </span>
                <span className="watchlist-change">
                  {formatChange(ticker?.change24hPct)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
