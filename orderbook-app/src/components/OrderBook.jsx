import { useMemo, useRef, useState } from 'react';
import { OrderBookRow } from './OrderBookRow';
import { buildLevels, TICK_OPTIONS } from '../lib/levels';
import { formatPrice } from '../lib/format';

const DEPTH = 20;

export function OrderBook({ book, baseAsset = 'BTC', quoteAsset = 'USDT' }) {
  const [tickSize, setTickSize] = useState(TICK_OPTIONS[0]);
  const prevMidRef = useRef(null);
  const [midDirection, setMidDirection] = useState('flat');

  const asks = useMemo(
    () => buildLevels(book.asks, { side: 'ask', tickSize, depth: DEPTH }),
    [book.asks, tickSize]
  );
  const bids = useMemo(
    () => buildLevels(book.bids, { side: 'bid', tickSize, depth: DEPTH }),
    [book.bids, tickSize]
  );

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const spreadPct = spread != null && mid ? (spread / mid) * 100 : null;

  if (mid != null) {
    if (prevMidRef.current != null && mid !== prevMidRef.current) {
      const dir = mid > prevMidRef.current ? 'up' : 'down';
      if (dir !== midDirection) setMidDirection(dir);
    }
    prevMidRef.current = mid;
  }

  const hasData = asks.length > 0 || bids.length > 0;

  return (
    <div className="orderbook-card">
      <div className="orderbook-toolbar">
        <span className="title">Order Book</span>
        <select
          className="grouping-select"
          value={tickSize}
          onChange={(e) => setTickSize(Number(e.target.value))}
          aria-label="Price grouping"
        >
          {TICK_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="col-headers">
        <span>Price ({quoteAsset})</span>
        <span>Amount ({baseAsset})</span>
        <span>Total ({baseAsset})</span>
      </div>

      {!hasData ? (
        <div className="empty-state">Waiting for order book data…</div>
      ) : (
        <>
          <div className="levels asks">
            {asks.map((row) => (
              <OrderBookRow key={row.price} side="ask" {...row} />
            ))}
          </div>

          <div className="spread-row">
            <span className={`mid-price ${midDirection}`}>
              {mid != null ? formatPrice(mid) : '—'}
            </span>
            <span className="spread-label">
              {spread != null
                ? `Spread ${formatPrice(spread)} (${spreadPct.toFixed(3)}%)`
                : ''}
            </span>
          </div>

          <div className="levels bids">
            {bids.map((row) => (
              <OrderBookRow key={row.price} side="bid" {...row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
