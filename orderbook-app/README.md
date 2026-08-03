# BTC/USDT Order Book

A Binance-style trading view (React + Vite): a live candlestick chart
beside an order book showing 20 bid levels and 20 ask levels, each with
Price (USDT), Amount (BTC), and cumulative Total (BTC), plus a live
spread indicator and a price-grouping selector.

It connects directly to Binance's public market data streams - no
backend/API key required.

**Live:** <https://alhubanov.github.io/orderbook/>

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (typically http://localhost:5173). You
should see "Connecting…" → "Syncing…" → "Live" in the header, then a
live, continuously-updating order book and chart.

## How the live order book works

The app keeps a full local copy of the book rather than reading a
partial-book stream. `depth20@100ms` would cover the 20 rows on screen,
but the grouping selector aggregates raw levels into wider bins - at a
tick of 100, twenty rows span far more than the top 20 raw levels - so
the full book is needed.

It follows Binance's documented procedure for maintaining a correct
local order book:

1. Open `wss://stream.binance.com:9443/ws/btcusdt@depth` (the 1000ms
   diff stream; the 100ms variant is `@depth@100ms`) and buffer
   incoming diff events.
2. Fetch a REST snapshot from `GET /api/v3/depth?symbol=BTCUSDT&limit=1000`.
3. Discard buffered events older than the snapshot, apply the first
   event that "bridges" the snapshot's `lastUpdateId`, then keep
   applying events in order.
4. If any event's `U` doesn't line up with the previous event's `u + 1`,
   the local book and the stream have diverged, so the app
   automatically reconnects and resyncs from a fresh snapshot.

The bridging check in step 3 also applies to the first event that
arrives straight off the socket, not just buffered ones - the buffer is
legitimately empty when the snapshot lands between two events, and
skipping the check there lets a missed update corrupt the book silently
for the rest of the session.

This logic lives in `src/lib/orderBookManager.js` and is intentionally
framework-agnostic so it's easy to unit test in isolation from React.

Reconnection uses exponential backoff (capped at 10s) and is automatic - no user action needed if the connection drops.

## The chart

Candles come from `GET /api/v3/klines` for history (500 bars) plus the
`btcusdt@kline_<interval>` stream for live updates, at intervals 1m
through 1d. `src/lib/klineFeed.js` mirrors `OrderBookManager`: it opens
the socket *before* requesting history and buffers whatever arrives in
between, so no update is lost in the gap.

Rendering is [lightweight-charts](https://github.com/tradingview/lightweight-charts)
v5 (note: v5 uses `chart.addSeries(CandlestickSeries, …)`, not v4's
`addCandlestickSeries`). An always-visible OHLC readout tracks the
hovered candle, falling back to the newest one - so no value depends on
telling the red and green candles apart.

The time axis honours the `tickMarkType` the scale passes to
`tickMarkFormatter`. Formatting every tick as a time makes day-boundary
ticks all render "12:00 AM"; month ticks show a bare month name, since
`{ month: 'short', year: '2-digit' }` renders "Aug '26" which reads as a
day of month next to "Jul 31".

## Deployment

Pushes to `main` that touch `orderbook-app/**` trigger
`.github/workflows/deploy.yml`, which builds the app and publishes it to
GitHub Pages. `vite.config.js` sets `base: '/orderbook/'` for production
builds only, so the dev server stays at `/`; that base must match the
repo name or the deployed assets 404.

GitHub Pages sends `cache-control: max-age=600` on the HTML, so a fresh
deploy can take up to ~10 minutes to appear, or needs a cache-bypassing
reload (Ctrl/Cmd+Shift+R).

## Project structure

```
src/
  lib/
    orderBookManager.js   # depth WebSocket + REST sync engine (framework-agnostic)
    klineFeed.js          # kline WebSocket + REST history (framework-agnostic)
    levels.js             # grouping + cumulative-total calculation
    format.js             # number formatting
  hooks/
    useOrderBook.js       # React hook wrapping OrderBookManager, throttled renders
  components/
    PriceChart.jsx        # candlestick + volume chart, interval toolbar, OHLC readout
    OrderBook.jsx         # toolbar, headers, ask/bid ladders, spread row
    OrderBookRow.jsx      # single row + depth bar
  App.jsx
  main.jsx
  index.css
```

`PriceChart` owns its own feed rather than going through a hook, so live
candles update the chart imperatively without re-rendering the app on
every tick.
