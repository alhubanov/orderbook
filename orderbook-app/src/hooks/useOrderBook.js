import { useEffect, useRef, useState } from 'react';
import { OrderBookManager, STATUS } from '../lib/orderBookManager';

// Re-render on the same cadence Binance pushes on. Rendering faster than the
// stream only burns frames on identical data; rendering much slower makes the
// book visibly lag binance.com.
const RENDER_INTERVAL_MS = { '100ms': 250, '1000ms': 1000 };

export function useOrderBook(symbol, { updateSpeed = '1000ms' } = {}) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [book, setBook] = useState({ bids: [], asks: [] });
  const [lastError, setLastError] = useState(null);

  const latestBookRef = useRef({ bids: [], asks: [] });
  const dirtyRef = useRef(false);
  const managerRef = useRef(null);

  useEffect(() => {
    const manager = new OrderBookManager(symbol, {
      updateSpeed,
      onStatusChange: setStatus,
      onUpdate: (snapshot) => {
        latestBookRef.current = snapshot;
        dirtyRef.current = true;
      },
      onError: (err) => setLastError(err?.message || String(err)),
    });
    managerRef.current = manager;
    manager.start();

    const interval = setInterval(() => {
      if (dirtyRef.current) {
        setBook(latestBookRef.current);
        dirtyRef.current = false;
      }
    }, RENDER_INTERVAL_MS[updateSpeed] ?? 1000);

    return () => {
      clearInterval(interval);
      manager.stop();
      managerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, updateSpeed]);

  return { status, book, lastError };
}
