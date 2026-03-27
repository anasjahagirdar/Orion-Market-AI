import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stocksAPI } from '../../services/api';
import StockTickerItem from './StockTickerItem';
import '../../styles/components/stock-ticker.css';

const POLL_INTERVAL_MS = 60 * 1000;
const MAX_TICKERS = 24;

const deriveChangePercent = (payload) => {
  const explicit = Number(payload?.change_percent ?? payload?.dp);
  if (Number.isFinite(explicit)) {
    return explicit;
  }

  const current = Number(payload?.current_price ?? payload?.c);
  const previous = Number(payload?.previous_close ?? payload?.pc);
  if (Number.isFinite(current) && Number.isFinite(previous) && previous !== 0) {
    return ((current - previous) / previous) * 100;
  }

  return null;
};

const normalizeTickerPayload = (stock, payload) => ({
  symbol: stock?.symbol || 'N/A',
  market: stock?.market || 'US',
  price: Number(payload?.current_price ?? payload?.c),
  changePercent: deriveChangePercent(payload),
});

const interleaveMarkets = (stocks) => {
  const indian = stocks.filter((stock) => stock.market === 'IN');
  const us = stocks.filter((stock) => stock.market !== 'IN');

  const mixed = [];
  const maxLength = Math.max(indian.length, us.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (us[index]) {
      mixed.push(us[index]);
    }
    if (indian[index]) {
      mixed.push(indian[index]);
    }
    if (mixed.length >= MAX_TICKERS) {
      break;
    }
  }

  return mixed.slice(0, MAX_TICKERS);
};

const StockTicker = () => {
  const [items, setItems] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const intervalRef = useRef(null);

  const fetchTickerData = useCallback(async () => {
    try {
      const stockListResponse = await stocksAPI.getAll();
      const stocks = stockListResponse?.data?.stocks || [];
      if (!stocks.length) {
        return;
      }

      const selected = interleaveMarkets(stocks);
      if (!selected.length) {
        return;
      }

      const results = await Promise.allSettled(
        selected.map((stock) => stocksAPI.getPrice(stock.symbol))
      );

      const normalized = selected.map((stock, index) => {
        const result = results[index];
        if (result?.status !== 'fulfilled') {
          return {
            symbol: stock.symbol,
            market: stock.market,
            price: null,
            changePercent: null,
          };
        }
        return normalizeTickerPayload(stock, result.value?.data || {});
      });

      const hasLivePoint = normalized.some(
        (entry) => Number.isFinite(entry.price) || Number.isFinite(entry.changePercent)
      );
      if (normalized.length > 0 && hasLivePoint) {
        setItems(normalized);
        setIsReady(true);
      }
    } catch (error) {
      // Ticker is supplementary UI; fail silently.
    }
  }, []);

  useEffect(() => {
    fetchTickerData();
    intervalRef.current = setInterval(fetchTickerData, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTickerData]);

  const duplicatedItems = useMemo(() => [...items, ...items], [items]);
  const durationSeconds = useMemo(() => Math.max(36, items.length * 3.6), [items.length]);

  if (!isReady || items.length === 0) {
    return null;
  }

  return (
    <section className="stock-ticker" aria-label="Live stock ticker">
      <div className="stock-ticker-marquee" style={{ '--ticker-duration': `${durationSeconds}s` }} role="list">
        <div className="stock-ticker-track">
          {duplicatedItems.map((item, index) => (
            <StockTickerItem key={`${item.symbol}-${index}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(StockTicker);

