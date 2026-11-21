import { describe, expect, it } from 'vitest';
import { SYMBOLS } from '../index';

describe('SYMBOLS', () => {
  it('lists PAXG/USDT with the Kraken USD pair', () => {
    const paxg = SYMBOLS.find((s) => s.id === 'PAXG/USDT');
    expect(paxg?.kind).toBe('tokenized-gold');
    expect(paxg?.providerSymbols.binance).toBe('PAXGUSDT');
    expect(paxg?.providerSymbols.kraken).toBe('PAXG/USD');
    expect(paxg?.providerSymbols.okx).toBe('PAXG-USDT');
    expect(paxg?.providerSymbols.gate).toBe('PAXG_USDT');
  });
});
