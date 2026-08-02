import { useOrderBook } from './hooks/useOrderBook';
import { OrderBook } from './components/OrderBook';
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
  const { status, book, lastError } = useOrderBook(SYMBOL, { updateSpeed: '100ms' });
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

      <OrderBook book={book} baseAsset="BTC" quoteAsset="USDT" />

      <p className="footnote">
        Live data from Binance public market streams (depth@100ms), synced
        against a REST snapshot per Binance's local order-book
        procedure. 20 levels per side. "Total" is the cumulative BTC
        amount from the best price out to that row, matching Binance's
        own order book convention.
      </p>
    </div>
  );
}
