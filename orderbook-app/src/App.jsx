import { useOrderBook } from './hooks/useOrderBook';
import { OrderBook } from './components/OrderBook';
import { PriceChart } from './components/PriceChart';
import { STATUS } from './lib/orderBookManager';

const SYMBOL = 'btcusdt';

const STATUS_LABEL = {
  [STATUS.IDLE]: 'Idle',
  [STATUS.CONNECTING]: 'Connecting…',
  [STATUS.SYNCING]: 'Syncing…',
  [STATUS.SYNCED]: 'Live',
  [STATUS.ERROR]: 'Reconnecting…',
  [STATUS.CLOSED]: 'Closed',
};

export default function App() {
  const { status, book, lastError } = useOrderBook(SYMBOL, { updateSpeed: '1000ms' });
  const dotClass = status === STATUS.SYNCED ? 'synced' : status === STATUS.ERROR ? 'error' : status;

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>
          BTC<span className="pair">/USDT</span>
        </h1>
        <span className="status-pill">
          <span className={`status-dot ${dotClass}`} />
          {STATUS_LABEL[status]}
        </span>
      </div>

      {lastError && status !== STATUS.SYNCED && (
        <div className="error-banner">Connection issue: {lastError} — retrying…</div>
      )}

      <div className="layout">
        <PriceChart symbol={SYMBOL} baseAsset="BTC" />
        <OrderBook book={book} baseAsset="BTC" quoteAsset="USDT" />
      </div>

      <p className="footnote">
        Live data from Binance public market streams (depth, 1000ms), synced
        against a REST snapshot per Binance's local order-book
        procedure. 20 levels per side. "Total" is the cumulative BTC
        amount from the best price out to that row, matching Binance's
        own order book convention. Candles come from /api/v3/klines plus the
        kline stream for the selected interval; hover (or touch) the chart to
        read exact OHLC values.
      </p>
    </div>
  );
}
