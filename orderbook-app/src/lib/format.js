const priceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(price) {
  return priceFormatter.format(price);
}

export function formatAmount(qty, decimals = 5) {
  return qty.toFixed(decimals);
}

export function formatTotal(total, decimals = 5) {
  return total.toFixed(decimals);
}
