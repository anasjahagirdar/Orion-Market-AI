import React from 'react';

const formatPrice = (price, market) => {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) {
    return 'N/A';
  }
  const prefix = market === 'IN' ? '\u20B9' : '$';
  return `${prefix}${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const formatPercent = (percent) => {
  const numeric = Number(percent);
  if (!Number.isFinite(numeric)) {
    return { text: 'N/A', tone: 'neutral', arrow: '' };
  }
  if (numeric > 0) {
    return { text: `+${numeric.toFixed(2)}%`, tone: 'positive', arrow: '\u25B2' };
  }
  if (numeric < 0) {
    return { text: `${numeric.toFixed(2)}%`, tone: 'negative', arrow: '\u25BC' };
  }
  return { text: '0.00%', tone: 'neutral', arrow: '\u2022' };
};

const StockTickerItem = ({ item }) => {
  const percent = formatPercent(item?.changePercent);

  return (
    <div className="stock-ticker-item" role="listitem" aria-label={`${item?.symbol || 'N/A'} ticker`}>
      <span className="stock-ticker-symbol">{item?.symbol || 'N/A'}</span>
      <span className="stock-ticker-price">{formatPrice(item?.price, item?.market)}</span>
      <span className={`stock-ticker-change ${percent.tone}`}>
        {percent.arrow ? `${percent.arrow} ` : ''}
        {percent.text}
      </span>
    </div>
  );
};

export default React.memo(StockTickerItem);
