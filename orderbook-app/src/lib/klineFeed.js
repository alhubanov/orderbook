/**
 * KlineFeed
 * ------------------------------------------------------------------
 * Feeds candlestick data for a Binance spot symbol: a REST history load
 * from GET /api/v3/klines, then live updates from the <symbol>@kline_<interval>
 * websocket stream.
 *
 * Same shape as OrderBookManager - framework-agnostic so the chart component
 * stays a thin wrapper. The socket is opened *before* the history request so
 * updates that land while that request is in flight are buffered rather than
 * dropped; they're replayed once history arrives.
 *
 * Binance kline REST rows are positional arrays:
 *   [openTime, open, high, low, close, volume, closeTime, ...]
 * and the stream wraps the same fields in an object under `k`.
 */

const DEFAULT_REST_BASE = 'https://api.binance.com';
const DEFAULT_WS_BASE = 'wss://stream.binance.com:9443';

/** Intervals offered in the chart toolbar. */
export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const FEED_STATUS = {
  LOADING: 'loading',
  LIVE: 'live',
  ERROR: 'error',
  CLOSED: 'closed',
};

/** How many historical candles to load. Weight is only 4 at this size. */
const HISTORY_LIMIT = 500;

export class KlineFeed {
  constructor(symbol, interval, opts = {}) {
    this.symbol = symbol.toLowerCase();
    this.interval = interval;
    this.restBase = opts.restBase || DEFAULT_REST_BASE;
    this.wsBase = opts.wsBase || DEFAULT_WS_BASE;
    this.limit = opts.limit || HISTORY_LIMIT;

    this.ws = null;
    this.buffer = [];
    this.historyLoaded = false;
    this._closedByUser = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;

    this.onHistory = opts.onHistory || (() => {});
    this.onCandle = opts.onCandle || (() => {});
    this.onStatusChange = opts.onStatusChange || (() => {});
    this.onError = opts.onError || (() => {});
  }

  start() {
    this._closedByUser = false;
    this.onStatusChange(FEED_STATUS.LOADING);
    this._connect();
  }

  stop() {
    this._closedByUser = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChange(FEED_STATUS.CLOSED);
  }

  _connect() {
    this.buffer = [];
    this.historyLoaded = false;

    const streamUrl = `${this.wsBase}/ws/${this.symbol}@kline_${this.interval}`;
    try {
      this.ws = new WebSocket(streamUrl);
    } catch (err) {
      this.onError(err);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => this._loadHistory();

    this.ws.onmessage = (evt) => {
      let payload;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (payload.e !== 'kline' || !payload.k) return;

      const candle = toCandle(payload.k);
      if (this.historyLoaded) this.onCandle(candle);
      else this.buffer.push(candle);
    };

    this.ws.onerror = (err) => this.onError(err);

    this.ws.onclose = () => {
      if (this._closedByUser) return;
      this.onStatusChange(FEED_STATUS.ERROR);
      this._scheduleReconnect();
    };
  }

  async _loadHistory() {
    try {
      const url =
        `${this.restBase}/api/v3/klines?symbol=${this.symbol.toUpperCase()}` +
        `&interval=${this.interval}&limit=${this.limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Klines HTTP ${res.status}`);
      const rows = await res.json();
      if (this._closedByUser) return;

      this.onHistory(rows.map(fromRestRow));

      // Replay anything that arrived while the request was in flight. Each
      // shares a time with either the last history candle or a newer one, and
      // the chart replaces by time, so duplicates are harmless.
      this.historyLoaded = true;
      for (const candle of this.buffer) this.onCandle(candle);
      this.buffer = [];

      this._reconnectAttempts = 0;
      this.onStatusChange(FEED_STATUS.LIVE);
    } catch (err) {
      if (this._closedByUser) return;
      this.onError(err);
      this.onStatusChange(FEED_STATUS.ERROR);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._closedByUser) return;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
    }
    const delay = Math.min(500 * 2 ** this._reconnectAttempts, 10000);
    this._reconnectAttempts += 1;
    this._reconnectTimer = setTimeout(() => this._connect(), delay);
  }
}

/**
 * lightweight-charts keys bars by UNIX *seconds*, so open times are divided
 * down from Binance's milliseconds.
 */
function fromRestRow(row) {
  return {
    time: row[0] / 1000,
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[5]),
    closed: true,
  };
}

function toCandle(k) {
  return {
    time: k.t / 1000,
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
    closed: Boolean(k.x),
  };
}
