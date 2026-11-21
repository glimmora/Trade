import { test, expect } from '@playwright/test';

// Deterministic smoke test: mocked provider fixtures only, no live data.
test('app shell renders with chart container', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chart-container')).toBeVisible();
  await expect(page.getByText('For informational purposes only.')).toBeVisible();
});

test('theme toggle switches dark/light', async ({ page }) => {
  await page.goto('/');
  const select = page.getByLabel('Theme');
  await select.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await select.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
