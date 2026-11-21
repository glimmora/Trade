import { test, expect } from '@playwright/test';

// Deterministic smoke test: mocked provider fixtures only, no live data.
// NOTE (QA): the app renders data-testid="chart" (ChartHost) and
// data-testid="chart-view" (ChartView). There is no "chart-container"
// testid anywhere in the app — the old selector was wrong and failed.
test('app shell renders with chart container', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('chart')).toBeVisible();
  await expect(page.getByTestId('chart-view')).toBeVisible();
  // No live data is wired in yet: the chart honestly shows "No data".
  await expect(page.getByText('No data')).toBeVisible();
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
