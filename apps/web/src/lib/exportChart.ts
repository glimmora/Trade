/**
 * Chart snapshot export.
 *
 * Until the chart engine lands, this renders a labelled snapshot PNG of the
 * current view state (symbol, timeframe, provider, time) — it never invents
 * candle data. The chart engine will replace this with a capture of the real
 * chart canvas; the download filename and the button stay the same.
 */
export interface SnapshotState {
  symbol: string;
  timeframe: string;
  providerLabel: string;
  chartType: string;
}

export function downloadChartSnapshot(state: SnapshotState): void {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText(`${state.symbol} — ${state.timeframe}`, 48, 96);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(`${state.chartType} · ${state.providerLabel}`, 48, 148);
  ctx.fillText(new Date().toISOString(), 48, 196);
  ctx.fillStyle = '#64748b';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Chart snapshot — full chart export arrives with the chart engine.', 48, 660);
  ctx.fillText('For informational purposes only. Not financial advice.', 48, 696);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade-${state.symbol.replace('/', '-')}-${state.timeframe}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
