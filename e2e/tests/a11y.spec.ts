import { test, expect } from '@playwright/test';

/**
 * Accessibility checks (no axe dependency — structural checks only).
 * Contrast budgets are enforced by Lighthouse CI (see
 * .github/lighthouse-budget.json); keyboard and labelling checks live here.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('chart')).toBeVisible();
});

test('document has a language and a theme applied', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const theme = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(theme);
});

test('every button has an accessible name', async ({ page }) => {
  const unnamed = await page.locator('button').evaluate((buttons) =>
    buttons
      .filter((el) => {
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
        return name.length === 0;
      })
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
});

test('every select and input has an accessible label', async ({ page }) => {
  const unlabelled = await page
    .locator('select, input:not([type="file"])')
    .evaluate((controls) =>
      controls
        .filter((el) => {
          const labelled =
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.closest('label') ||
            (el.id !== '' && document.querySelector(`label[for="${el.id}"]`));
          return !labelled;
        })
        .map((el) => el.outerHTML.slice(0, 140)),
    );
  expect(unlabelled).toEqual([]);
});

test('keyboard: Tab moves focus in order, focus stays visible', async ({ page }) => {
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(['BUTTON', 'SELECT', 'INPUT', 'A']).toContain(first);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
  }
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { tag: el.tagName, visible: rect.width > 0 && rect.height > 0 };
  });
  expect(focused).not.toBeNull();
  expect(focused?.visible).toBe(true);
});

test('keyboard: ? opens the shortcuts dialog, Escape closes it', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  // Focus starts on the dialog close button (Modal focuses it on mount).
  const focusedLabel = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label'),
  );
  expect(focusedLabel).toBe('Close');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
});

test('keyboard: F toggles fullscreen request, S triggers the PNG flow', async ({ page }) => {
  // Headless fullscreen may be unavailable; the key must not throw or
  // navigate away. S must surface the save toast.
  await page.keyboard.press('f');
  await expect(page.getByTestId('chart')).toBeVisible();
  await page.keyboard.press('s');
  await expect(page.getByText('Chart snapshot saved as PNG.')).toBeVisible();
});

test('dialogs are modal: role=dialog with aria-modal and a labelled title', async ({ page }) => {
  await page.getByRole('button', { name: 'Indicators' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Indicators' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('heading', { name: 'Indicators' })).toBeVisible();
});

test('chart region has an accessible name and the legend is live', async ({ page }) => {
  const chart = page.getByTestId('chart');
  await expect(chart).toHaveAttribute('aria-label', /BTC\/USDT 1h/);
  const view = page.getByTestId('chart-view');
  await expect(view).toHaveAttribute('aria-label', /Price chart for BTC\/USDT/);
  await expect(view.locator('[aria-live="polite"]')).toContainText('BTC/USDT · 1h');
});

test('toasts are announced via aria-live', async ({ page }) => {
  await page.getByRole('button', { name: '4h', exact: true }).click();
  const live = page.locator('.toasts[aria-live="polite"]');
  await expect(live).toContainText('Timeframe changed.');
});
