import { useEffect, useRef, useState } from 'react';
import { OrderBookManager, STATUS } from '../lib/orderBookManager';

// Re-render at most this often, independent of how fast Binance pushes
// updates (100ms). Keeps things smooth on low-power / mobile devices.
const RENDER_INTERVAL_MS = 250;

export function useOrderBook(symbol, { updateSpeed = '100ms' } = {}) {
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
    }, RENDER_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      manager.stop();
      managerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, updateSpeed]);

  return { status, book, lastError };
}
