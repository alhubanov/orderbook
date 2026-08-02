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

/**
 * BTCUSDT's PRICE_FILTER tickSize is 0.01, so every price Binance can quote
 * is a whole number of cents. Scaling by this before any rounding keeps the
 * bucketing in exact integer arithmetic.
 */
const PRICE_SCALE = 100;

function groupByTick(entries, tickSize, side) {
  if (!tickSize || tickSize <= 0) return entries;

  // Bucket in integer tick units rather than floats. `Math.floor(p / tickSize)`
  // lands on the wrong side of a boundary for ~15% of realistic BTC prices
  // (60000.09 / 0.01 === 6000008.999...), which drags a level a whole cent off
  // its true price and merges it into its neighbour.
  const tickUnits = Math.round(tickSize * PRICE_SCALE);

  const buckets = new Map(); // integer tick units -> qty
  for (const [price, qty] of entries) {
    const priceUnits = Math.round(price * PRICE_SCALE);
    const bucketUnits =
      side === 'bid'
        ? Math.floor(priceUnits / tickUnits) * tickUnits
        : Math.ceil(priceUnits / tickUnits) * tickUnits;
    buckets.set(bucketUnits, (buckets.get(bucketUnits) || 0) + qty);
  }

  const result = [...buckets.entries()].map(([units, qty]) => [units / PRICE_SCALE, qty]);
  result.sort((a, b) => (side === 'bid' ? b[0] - a[0] : a[0] - b[0]));
  return result;
}

/** Sensible default tick sizes offered in the grouping selector, by symbol. */
export const TICK_OPTIONS = [0.01, 0.1, 1, 10, 100];
