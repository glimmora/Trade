import type { IChartApi } from 'lightweight-charts';

/**
 * Render the chart to a canvas, or null when the library cannot produce a
 * screenshot (for example, before the chart is created). The caller owns
 * the returned canvas.
 */
export function takeChartScreenshot(chart: IChartApi): HTMLCanvasElement | null {
  try {
    return chart.takeScreenshot();
  } catch {
    return null;
  }
}

/** PNG data URL of the chart, or null when screenshots are unavailable. */
export function chartScreenshotDataUrl(chart: IChartApi): string | null {
  const canvas = takeChartScreenshot(chart);
  if (canvas === null) {
    return null;
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Download the chart as a PNG file. Returns true when the download was
 * started, false when screenshots or downloads are unavailable (for
 * example, outside a browser). The filename defaults to 'trade-chart.png'.
 */
export function downloadChartPng(
  chart: IChartApi,
  filename = 'trade-chart.png',
): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }
  const canvas = takeChartScreenshot(chart);
  if (canvas === null) {
    return false;
  }
  let started = false;
  canvas.toBlob((blob) => {
    if (blob === null) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
  started = true;
  return started;
}

/**
 * Request fullscreen for an element. Resolves when fullscreen is entered;
 * resolves (without throwing) when the browser refuses or fullscreen is
 * unsupported, so callers can treat it as best-effort.
 */
export async function requestFullscreen(element: HTMLElement): Promise<void> {
  try {
    await element.requestFullscreen();
  } catch {
    // Fullscreen is best-effort; the chart stays usable inline.
    return;
  }
}

/** Exit fullscreen when active. Best-effort; never throws. */
export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined' || document.fullscreenElement === null) {
    return;
  }
  try {
    await document.exitFullscreen();
  } catch {
    return;
  }
}

/** True when any element is currently fullscreen. */
export function isFullscreen(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.fullscreenElement !== null;
}
