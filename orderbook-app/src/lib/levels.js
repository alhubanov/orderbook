/**
 * Turns raw [price, qty] entries into the rows the UI renders:
 * groups by a tick size, keeps the best N groups, and adds a running
 * cumulative total (matching Binance's "Total" column, which is the
 * accumulated Amount from the best price out to that row - not
 * price * qty for a single row).
 */
export function buildLevels(entries, { side, tickSize, depth }) {
  const grouped = groupByTick(entries, tickSize, side);
  const top = grouped.slice(0, depth);

  let cumulative = 0;
  const withCumulative = top.map(([price, qty]) => {
    cumulative += qty;
    return { price, qty, total: cumulative };
  });

  const maxTotal = withCumulative.length
    ? withCumulative[withCumulative.length - 1].total
    : 0;

  return withCumulative.map((row) => ({
    ...row,
    depthPct: maxTotal > 0 ? (row.total / maxTotal) * 100 : 0,
  }));
}

function groupByTick(entries, tickSize, side) {
  if (!tickSize || tickSize <= 0) return entries;

  const buckets = new Map();
  for (const [price, qty] of entries) {
    const bucketPrice =
      side === 'bid'
        ? Math.floor(price / tickSize) * tickSize
        : Math.ceil(price / tickSize) * tickSize;
    const roundedKey = Number(bucketPrice.toFixed(8));
    buckets.set(roundedKey, (buckets.get(roundedKey) || 0) + qty);
  }

  const result = [...buckets.entries()];
  result.sort((a, b) => (side === 'bid' ? b[0] - a[0] : a[0] - b[0]));
  return result;
}

/** Sensible default tick sizes offered in the grouping selector, by symbol. */
export const TICK_OPTIONS = [0.01, 0.1, 1, 10, 100];
