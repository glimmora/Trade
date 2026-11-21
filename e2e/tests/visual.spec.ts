import { test, expect } from '@playwright/test';

/**
 * Visual regression, first-run safe.
 *
 * These tests capture screenshots into the Playwright report artifacts and
 * assert only that a real image was produced — they do NOT pixel-compare
 * against a baseline, because no baseline exists yet and the first CI run
 * must not fail on a missing snapshot.
 *
 * After the first green run, promote the captures to baselines by replacing
 * the buffer-length assertions with:
 *   await expect(page).toHaveScreenshot('trade-desktop.png', {
 *     maxDiffPixels: 100, animations: 'disabled',
 *   });
 * and committing the generated snapshots under e2e/tests/__snapshots__/.
 * Mask the live legend before comparing: the OHLCV legend is deterministic
 * today ("No data" — no candles are wired in), but will become time-varying
 * once live candles land.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('chart')).toBeVisible();
});

test('desktop 1920x1080 shell screenshot is produced', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByTestId('chart-view')).toBeVisible();
  const shot = await page.screenshot({ fullPage: true });
  expect(shot.length).toBeGreaterThan(10_000);
});

test('desktop with an indicator and a drawing, screenshot is produced', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Indicators' }).first().click();
  await page
    .locator('.catalog-row', { hasText: 'Moving Average (SMA)' })
    .getByRole('button', { name: 'Add' })
    .click();
  await page.keyboard.press('Escape');
  await page
    .locator('nav[aria-label="Drawing tools"]')
    .first()
    .getByRole('button', { name: 'Trend line' })
    .click();
  await expect(page.locator('.sidebar').getByText('Trend line')).toBeVisible();
  const shot = await page.screenshot();
  expect(shot.length).toBeGreaterThan(10_000);
});

test('light theme screenshot is produced', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByLabel('Theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const shot = await page.screenshot();
  expect(shot.length).toBeGreaterThan(10_000);
});

test('mobile 390x844 screenshot is produced', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('chart')).toBeVisible();
  const shot = await page.screenshot({ fullPage: true });
  expect(shot.length).toBeGreaterThan(10_000);
});

test('indicators dialog screenshot is produced', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Indicators' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Indicators' })).toBeVisible();
  const shot = await page.screenshot();
  expect(shot.length).toBeGreaterThan(10_000);
});
