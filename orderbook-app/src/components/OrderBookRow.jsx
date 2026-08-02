import { formatAmount, formatPrice, formatTotal } from '../lib/format';

export function OrderBookRow({ side, price, qty, total, depthPct }) {
  return (
    <div className={`level-row ${side}`}>
      <div className="depth-bar" style={{ width: `${depthPct}%` }} />
      <span className="price">{formatPrice(price)}</span>
      <span className="qty">{formatAmount(qty)}</span>
      <span className="total">{formatTotal(total)}</span>
    </div>
  );
}
