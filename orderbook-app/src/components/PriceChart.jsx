import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import { FEED_STATUS, INTERVALS, KlineFeed } from '../lib/klineFeed';
import { formatPrice } from '../lib/format';

// Pulled from the same tokens the order book uses (index.css), so the candle
// colours and the bid/ask rows agree.
const UP = '#0ecb81';
const DOWN = '#f6465d';
const GRID = '#1c2026';
const BORDER = '#262b31';
const TEXT_MUTED = '#848e9c';

/**
 * lightweight-charts renders numeric times as UTC. Binance's own chart shows
 * local time, so both formatters below convert explicitly rather than shifting
 * the timestamps (which would corrupt the underlying values).
 */

// TickMarkType, from the library's enum: the scale tells us what kind of
// boundary each tick sits on. Formatting every tick as a time makes day
// boundaries all read "12:00 AM", which is why the type has to be honoured.
const TICK = { YEAR: 0, MONTH: 1, DAY: 2, TIME: 3, TIME_WITH_SECONDS: 4 };

function tickLabel(timeSec, tickMarkType) {
  const d = new Date(timeSec * 1000);
  switch (tickMarkType) {
    case TICK.YEAR:
      return String(d.getFullYear());
    case TICK.MONTH:
      // Bare month name: "Aug '26" beside "Jul 31" reads as a day-of-month.
      // Year boundaries get their own tick type, so the year isn't lost.
      return d.toLocaleDateString([], { month: 'short' });
    case TICK.DAY:
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case TICK.TIME_WITH_SECONDS:
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    case TICK.TIME:
    default:
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function fullTimeLabel(timeSec) {
  return new Date(timeSec * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVolume(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(2)}K`;
  return v.toFixed(3);
}

export function PriceChart({ symbol = 'btcusdt', baseAsset = 'BTC' }) {
  const [interval, setChartInterval] = useState('15m');
  const [status, setStatus] = useState(FEED_STATUS.LOADING);
  // The candle currently under the crosshair, falling back to the newest one.
  const [readout, setReadout] = useState(null);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);

  // Create the chart once. Interval changes swap the data, not the chart.
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: TEXT_MUTED,
        fontFamily: "'Roboto Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      // Hairline, solid gridlines one shade off the surface - dashed grids read
      // as thresholds rather than chrome.
      grid: {
        vertLines: { color: GRID, style: LineStyle.Solid },
        horzLines: { color: GRID, style: LineStyle.Solid },
      },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: {
        borderColor: BORDER,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time, tickMarkType) => tickLabel(time, tickMarkType),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TEXT_MUTED, width: 1, style: LineStyle.Dotted, labelBackgroundColor: '#2b3139' },
        horzLine: { color: TEXT_MUTED, width: 1, style: LineStyle.Dotted, labelBackgroundColor: '#2b3139' },
      },
      localization: { timeFormatter: fullTimeLabel },
      // Let a vertical swipe scroll the page on mobile; horizontal drag still
      // pans the chart and pinch still zooms.
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true, axisPressedMouseMove: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    // Pin volume to the bottom fifth so it reads as a subordinate band rather
    // than a second y-axis competing with price.
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    chart.subscribeCrosshairMove((param) => {
      const bar = param.seriesData?.get(candleSeries);
      const vol = param.seriesData?.get(volumeSeries);
      if (!bar) {
        setReadout(lastCandleRef.current);
        return;
      }
      setReadout({ ...bar, volume: vol?.value ?? 0 });
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // (Re)subscribe whenever the symbol or interval changes.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return undefined;

    setStatus(FEED_STATUS.LOADING);

    const volumeBar = (c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(14, 203, 129, 0.35)' : 'rgba(246, 70, 93, 0.35)',
    });

    const feed = new KlineFeed(symbol, interval, {
      onHistory: (candles) => {
        candleSeries.setData(candles);
        volumeSeries.setData(candles.map(volumeBar));
        lastCandleRef.current = candles[candles.length - 1] ?? null;
        setReadout(lastCandleRef.current);
        chartRef.current?.timeScale().fitContent();
      },
      onCandle: (candle) => {
        // update() replaces the bar with the same time, so a still-forming
        // candle is overwritten in place until it closes.
        candleSeries.update(candle);
        volumeSeries.update(volumeBar(candle));
        lastCandleRef.current = candle;
        setReadout((prev) => (prev && prev.time !== candle.time ? prev : candle));
      },
      onStatusChange: setStatus,
      onError: () => {},
    });

    feed.start();
    return () => feed.stop();
  }, [symbol, interval]);

  const up = readout ? readout.close >= readout.open : true;
  const changePct = readout && readout.open ? ((readout.close - readout.open) / readout.open) * 100 : 0;

  return (
    <div className="chart-card">
      <div className="chart-toolbar" role="group" aria-label="Chart interval">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            type="button"
            className={`interval-btn ${iv === interval ? 'active' : ''}`}
            aria-pressed={iv === interval}
            onClick={() => setChartInterval(iv)}
          >
            {iv}
          </button>
        ))}
        <span className={`chart-status ${status}`}>
          {status === FEED_STATUS.LIVE ? 'Live' : status === FEED_STATUS.ERROR ? 'Reconnecting…' : 'Loading…'}
        </span>
      </div>

      {/* Exact OHLC for the hovered candle (newest when not hovering), so
          values never depend on reading the candle colour. */}
      <div className="chart-legend" aria-live="off">
        {readout ? (
          <>
            <span className="legend-time">{fullTimeLabel(readout.time)}</span>
            <span className="legend-pair">
              <em>O</em>
              <b className={up ? 'up' : 'down'}>{formatPrice(readout.open)}</b>
            </span>
            <span className="legend-pair">
              <em>H</em>
              <b className={up ? 'up' : 'down'}>{formatPrice(readout.high)}</b>
            </span>
            <span className="legend-pair">
              <em>L</em>
              <b className={up ? 'up' : 'down'}>{formatPrice(readout.low)}</b>
            </span>
            <span className="legend-pair">
              <em>C</em>
              <b className={up ? 'up' : 'down'}>{formatPrice(readout.close)}</b>
            </span>
            <span className={`legend-change ${up ? 'up' : 'down'}`}>
              {changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%
            </span>
            <span className="legend-pair vol">
              <em>Vol</em>
              <b>
                {formatVolume(readout.volume ?? 0)} {baseAsset}
              </b>
            </span>
          </>
        ) : (
          <span className="legend-time">Loading candles…</span>
        )}
      </div>

      <div className="chart-canvas" ref={containerRef} />
    </div>
  );
}
