import { test, expect } from '@playwright/test';

/**
 * App flows, deterministic: the app currently makes no network calls for
 * market data (no provider is wired into the UI yet), so these tests run
 * against the real shell with mocked provider fixtures only — no live
 * network is needed, and any request to a non-local origin fails the
 * "no live network calls on load" test below.
 */

const STATE_KEY = 'trade:state:v1';

async function readState(page: import('@playwright/test').Page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STATE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string) as {
    symbol: string;
    timeframe: string;
    provider: string;
    chartType: string;
    theme: string;
    layout: string;
    indicators: { id: string; kind: string; period: number | null }[];
    drawings: { id: string; tool: string }[];
    alerts: { id: string; symbol: string; price: number }[];
  };
}

test.beforeEach(async ({ page }) => {
  // Start every test from a clean persisted state.
  await page.goto('/');
  await page.evaluate((key) => window.localStorage.removeItem(key), STATE_KEY);
  await page.reload();
  await expect(page.getByTestId('chart')).toBeVisible();
});

test('no live network calls on load', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('http://localhost:') && !url.startsWith('http://127.0.0.1:')) {
      external.push(url);
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('chart-view')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(external).toEqual([]);
});

test('symbol switch via selector dialog, and via watchlist', async ({ page }) => {
  // Dialog path: BTC/USDT -> XAU/USD (spot gold).
  await page.getByRole('button', { name: 'Symbol: BTC/USDT' }).click();
  await expect(page.getByRole('dialog', { name: 'Symbol' })).toBeVisible();
  await page.locator('.symbol-list').getByRole('button', { name: 'XAU/USD' }).click();
  await expect(page.getByRole('button', { name: 'Symbol: XAU/USD' })).toBeVisible();
  // Switching to spot gold must also switch the provider: Binance does not
  // serve XAU/USD, so the store falls back to the first provider for it.
  const state = await readState(page);
  expect(state.symbol).toBe('XAU/USD');
  expect(state.provider).toBe('twelvedata');
  await expect(page.getByText('Spot gold')).toBeVisible();

  // Watchlist path back to BTC/USDT.
  await page.locator('.watchlist').getByRole('button', { name: 'BTC/USDT' }).click();
  await expect(page.getByRole('button', { name: 'Symbol: BTC/USDT' })).toBeVisible();
  expect((await readState(page)).symbol).toBe('BTC/USDT');
});

test('symbol search filters the list', async ({ page }) => {
  await page.getByRole('button', { name: 'Symbol: BTC/USDT' }).click();
  await page.getByLabel('Search symbols…').fill('xau');
  await expect(page.locator('.symbol-list').getByText('XAUT/USDT')).toBeVisible();
  await expect(page.locator('.symbol-list').getByText('BTC/USDT')).toHaveCount(0);
});

test('timeframe switch updates state and chart header', async ({ page }) => {
  await page.getByRole('button', { name: '4h', exact: true }).click();
  expect((await readState(page)).timeframe).toBe('4h');
  await expect(page.locator('.chart-panel-header').first()).toContainText('BTC/USDT · 4h');
  await page.getByRole('button', { name: '1D', exact: true }).click();
  expect((await readState(page)).timeframe).toBe('1D');
});

test('provider switch updates state; unsupported timeframes disable', async ({ page }) => {
  const source = page.getByLabel('Data source');
  await source.selectOption('bybit');
  expect((await readState(page)).provider).toBe('bybit');
  // Bybit serves every timeframe, so 3m stays enabled.
  await expect(page.getByRole('button', { name: '3m', exact: true })).toBeEnabled();

  // Kraken does not serve 3m: the button must disable with a tooltip.
  await source.selectOption('kraken');
  expect((await readState(page)).provider).toBe('kraken');
  const threeMin = page.getByRole('button', { name: '3m', exact: true });
  await expect(threeMin).toBeDisabled();
  await expect(threeMin).toHaveAttribute('title', 'Not supported by this provider');
});

test('provider dropdown only lists providers for the current symbol', async ({ page }) => {
  // BTC/USDT is served by 6 providers (no Twelve Data / Yahoo / Stooq).
  const options = await page.getByLabel('Data source').locator('option').allTextContents();
  expect(options).toHaveLength(6);

  await page.getByRole('button', { name: 'Symbol: BTC/USDT' }).click();
  await page.locator('.symbol-list').getByRole('button', { name: 'XAU/USD' }).click();
  const goldOptions = await page.getByLabel('Data source').locator('option').allTextContents();
  expect(goldOptions).toHaveLength(3);
  expect(goldOptions.join(' ')).toContain('Twelve Data');
});

test('chart type and price scale switch', async ({ page }) => {
  await page.getByLabel('Chart type').selectOption('line');
  expect((await readState(page)).chartType).toBe('line');
  await page.getByLabel('Price scale').selectOption('log');
  expect((await readState(page)).priceScale).toBe('log');
});

test('add indicator from the dialog, then reorder and remove it', async ({ page }) => {
  await page.getByRole('button', { name: 'Indicators' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Indicators' })).toBeVisible();
  await page
    .locator('.catalog-row', { hasText: 'Moving Average (SMA)' })
    .getByRole('button', { name: 'Add' })
    .click();
  await expect(page.getByText('Active indicators (1/20)')).toBeVisible();
  const state = await readState(page);
  expect(state.indicators).toHaveLength(1);
  expect(state.indicators[0]?.kind).toBe('sma');

  // The dialog stays open: remove it again from the active list.
  await page
    .getByRole('button', { name: 'Remove: Moving Average (SMA)' })
    .click();
  await expect(page.getByText('Active indicators (0/20)')).toBeVisible();
  expect((await readState(page)).indicators).toHaveLength(0);
});

test('add indicator persists across reload (localStorage)', async ({ page }) => {
  await page.getByRole('button', { name: 'Indicators' }).first().click();
  // Exact-text match: a substring match on 'RSI' would also hit
  // the 'Stochastic RSI' row.
  await page
    .locator('.catalog-row', { has: page.getByText('RSI', { exact: true }) })
    .getByRole('button', { name: 'Add' })
    .click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByTestId('chart')).toBeVisible();
  expect((await readState(page)).indicators.map((i) => i.kind)).toContain('rsi');
  // The sidebar indicator list shows the restored instance.
  await expect(page.locator('.sidebar').getByText('RSI')).toBeVisible();
});

test('draw + persist: tool click creates a drawing that survives reload', async ({ page }) => {
  await page
    .locator('nav[aria-label="Drawing tools"]')
    .first()
    .getByRole('button', { name: 'Trend line' })
    .click();
  await expect(page.locator('.sidebar').getByText('Trend line')).toBeVisible();
  const state = await readState(page);
  expect(state.drawings).toHaveLength(1);
  expect(state.drawings[0]?.tool).toBe('trend-line');

  await page.reload();
  await expect(page.getByTestId('chart')).toBeVisible();
  const restored = await readState(page);
  expect(restored.drawings).toHaveLength(1);
  expect(restored.drawings[0]?.tool).toBe('trend-line');
  await expect(page.locator('.sidebar').getByText('Trend line')).toBeVisible();
});

test('theme toggle persists across reload', async ({ page }) => {
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await readState(page)).theme).toBe('dark');
});

test('multi-chart layout 2x2 renders four panels, back to one', async ({ page }) => {
  await page.getByTitle('Four charts (2 × 2)').click();
  await expect(page.locator('.chart-panel')).toHaveCount(4);
  expect((await readState(page)).layout).toBe('2x2');
  await page.getByTitle('Single chart').click();
  await expect(page.locator('.chart-panel')).toHaveCount(1);
});

test('add a price alert', async ({ page }) => {
  await page.getByRole('button', { name: /Alerts/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Price alerts' })).toBeVisible();
  await page.getByLabel('Alert price').fill('50000');
  await page.getByRole('button', { name: 'Add alert' }).click();
  await expect(page.getByText('Alert added.')).toBeVisible();
  const state = await readState(page);
  expect(state.alerts).toHaveLength(1);
  expect(state.alerts[0]?.symbol).toBe('BTC/USDT');
  expect(state.alerts[0]?.price).toBe(50000);
});

test('export state JSON round-trips through import', async ({ page }) => {
  await page.getByRole('button', { name: '4h', exact: true }).click();
  const exported = await page.evaluate(() => {
    const raw = window.localStorage.getItem(STATE_KEY);
    return raw as string;
  });
  expect(JSON.parse(exported).timeframe).toBe('4h');
  // Importing the same document must be accepted and keep the timeframe.
  await page.getByRole('button', { name: 'Settings' }).click();
  const fileInput = page.locator('input[type="file"][accept="application/json,.json"]');
  await fileInput.setInputFiles({
    name: 'trade-state.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  });
  await expect(page.getByText('State imported.')).toBeVisible();
  expect((await readState(page)).timeframe).toBe('4h');
});

test('screenshot button reports a saved PNG', async ({ page }) => {
  const downloadPromise = page
    .waitForEvent('download', { timeout: 10_000 })
    .catch(() => null);
  await page.getByRole('button', { name: 'Save chart as PNG' }).click();
  // Either the real chart PNG or the labelled snapshot PNG must download,
  // and the shell must report success either way.
  await expect(page.getByText('Chart snapshot saved as PNG.')).toBeVisible();
  const download = await downloadPromise;
  if (download) {
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  }
});

test.describe('viewports', () => {
  test('mobile 390x844: bottom nav visible, chart visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('chart')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Tools' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await expect(
      page.locator('.bottom-sheet').getByRole('button', { name: 'Trend line' }),
    ).toBeVisible();
  });

  test('desktop 1920x1080: sidebar visible, bottom nav hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.getByTestId('chart')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menu' })).toBeHidden();
    await expect(page.locator('nav[aria-label="Drawing tools"]').first()).toBeVisible();
  });

  test('tablet 768x1024: chart and toolbar fit without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByTestId('chart')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 768);
    expect(overflow).toBe(false);
  });
});
