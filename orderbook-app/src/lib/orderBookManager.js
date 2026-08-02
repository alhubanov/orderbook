/**
 * OrderBookManager
 * ------------------------------------------------------------------
 * Maintains a correct local limit order book for a Binance spot symbol
 * by following the procedure documented at:
 * https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams/~
 * (Diff. Depth Stream) combined with the REST /api/v3/depth snapshot.
 *
 * Algorithm (paraphrased from Binance's docs):
 *  1. Open a websocket to {symbol}@depth (1000ms) and buffer every event.
 *  2. Fetch a REST snapshot (GET /api/v3/depth) to get lastUpdateId + book.
 *  3. Discard any buffered event whose final update id (u) <= lastUpdateId.
 *  4. The first event applied must satisfy U <= lastUpdateId+1 <= u.
 *  5. Apply that event and every subsequent one in order. Each new event's
 *     U must equal the previous applied event's u + 1 - otherwise the
 *     stream and snapshot have diverged and we must resync from scratch.
 *  6. For every [price, qty] pair: qty === "0" means "remove this price
 *     level", otherwise it's the new absolute quantity at that price.
 *
 * This class is framework-agnostic on purpose so it can be unit tested
 * and reused outside React.
 */

const DEFAULT_REST_BASE = 'https://api.binance.com';
const DEFAULT_WS_BASE = 'wss://stream.binance.com:9443';

export const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  ERROR: 'error',
  CLOSED: 'closed',
};

export class OrderBookManager {
  constructor(symbol, opts = {}) {
    this.symbol = symbol.toLowerCase();
    this.restBase = opts.restBase || DEFAULT_REST_BASE;
    this.wsBase = opts.wsBase || DEFAULT_WS_BASE;
    this.updateSpeed = opts.updateSpeed || '1000ms'; // '1000ms' or '100ms'
    this.depthLimit = opts.depthLimit || 1000; // REST snapshot depth

    this.bids = new Map(); // price(number) -> qty(number)
    this.asks = new Map();

    this.ws = null;
    this.buffer = [];
    this.lastUpdateId = null;
    this.prevFinalUpdateId = null;
    this.status = STATUS.IDLE;

    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._closedByUser = false;

    this.onStatusChange = opts.onStatusChange || (() => {});
    this.onUpdate = opts.onUpdate || (() => {});
    this.onError = opts.onError || (() => {});
  }

  start() {
    this._closedByUser = false;
    this._connect();
  }

  stop() {
    this._closedByUser = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._setStatus(STATUS.CLOSED);
  }

  _setStatus(status) {
    this.status = status;
    this.onStatusChange(status);
  }

  async _connect() {
    this._setStatus(STATUS.CONNECTING);
    this.bids.clear();
    this.asks.clear();
    this.buffer = [];
    this.lastUpdateId = null;
    this.prevFinalUpdateId = null;

    // Binance names the 1000ms diff stream `<symbol>@depth` with no suffix;
    // only the 100ms variant carries one.
    const speedSuffix = this.updateSpeed === '100ms' ? '@100ms' : '';
    const streamUrl = `${this.wsBase}/ws/${this.symbol}@depth${speedSuffix}`;

    try {
      this.ws = new WebSocket(streamUrl);
    } catch (err) {
      this._handleFatalError(err);
      return;
    }

    this.ws.onopen = () => {
      this._setStatus(STATUS.SYNCING);
      // Snapshot is fetched only once the socket is open, so we don't
      // miss any events that occur while the REST request is in flight.
      this._fetchSnapshotAndSync();
    };

    this.ws.onmessage = (evt) => {
      let payload;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (this.status === STATUS.SYNCED) {
        this._applyEvent(payload);
      } else {
        this.buffer.push(payload);
      }
    };

    this.ws.onerror = (err) => {
      this.onError(err);
    };

    this.ws.onclose = () => {
      if (this._closedByUser) return;
      this._setStatus(STATUS.ERROR);
      this._scheduleReconnect();
    };
  }

  async _fetchSnapshotAndSync() {
    try {
      const url = `${this.restBase}/api/v3/depth?symbol=${this.symbol.toUpperCase()}&limit=${this.depthLimit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
      const snapshot = await res.json();

      this.lastUpdateId = snapshot.lastUpdateId;
      this.bids = new Map(snapshot.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)]));
      this.asks = new Map(snapshot.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)]));

      // Drop stale buffered events, then find + apply the first valid one.
      this.buffer = this.buffer.filter((e) => e.u > this.lastUpdateId);

      let firstIdx = this.buffer.findIndex(
        (e) => e.U <= this.lastUpdateId + 1 && e.u >= this.lastUpdateId + 1
      );

      if (firstIdx === -1 && this.buffer.length > 0) {
        // Nothing in the buffer bridges the snapshot -> stream is ahead
        // or behind; simplest safe move is to resync from scratch.
        this._scheduleReconnect();
        return;
      }

      if (firstIdx > -1) {
        for (let i = firstIdx; i < this.buffer.length; i++) {
          this._applyEvent(this.buffer[i]);
        }
      }
      this.buffer = [];
      this._reconnectAttempts = 0;
      this._setStatus(STATUS.SYNCED);
      this._emitUpdate();
    } catch (err) {
      this.onError(err);
      this._scheduleReconnect();
    }
  }

  _applyEvent(evt) {
    if (evt.e !== 'depthUpdate') return;

    if (this.prevFinalUpdateId == null) {
      // Nothing applied since the snapshot yet. Whether this event came out of
      // the buffer or straight off the wire (the buffer is legitimately empty
      // when the snapshot lands between two events), it must straddle
      // lastUpdateId + 1 or we've missed updates and the book would silently
      // diverge for the rest of the session.
      if (evt.u <= this.lastUpdateId) return; // already covered by the snapshot
      if (!(evt.U <= this.lastUpdateId + 1 && evt.u >= this.lastUpdateId + 1)) {
        this._scheduleReconnect();
        return;
      }
    } else if (evt.U !== this.prevFinalUpdateId + 1) {
      // Gap detected: stream out of sync with local book, must resync.
      this._scheduleReconnect();
      return;
    }

    for (const [priceStr, qtyStr] of evt.b) {
      const price = parseFloat(priceStr);
      const qty = parseFloat(qtyStr);
      if (qty === 0) this.bids.delete(price);
      else this.bids.set(price, qty);
    }
    for (const [priceStr, qtyStr] of evt.a) {
      const price = parseFloat(priceStr);
      const qty = parseFloat(qtyStr);
      if (qty === 0) this.asks.delete(price);
      else this.asks.set(price, qty);
    }

    this.prevFinalUpdateId = evt.u;
    if (this.status === STATUS.SYNCED) this._emitUpdate();
  }

  _emitUpdate() {
    this.onUpdate(this.getSnapshot());
  }

  /** Returns { bids, asks } sorted best-first, each entry [price, qty]. */
  getSnapshot() {
    const bids = [...this.bids.entries()].sort((a, b) => b[0] - a[0]);
    const asks = [...this.asks.entries()].sort((a, b) => a[0] - b[0]);
    return { bids, asks };
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

  _handleFatalError(err) {
    this.onError(err);
    this._setStatus(STATUS.ERROR);
    this._scheduleReconnect();
  }
}
