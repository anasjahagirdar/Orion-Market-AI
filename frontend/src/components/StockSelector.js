import React, { useEffect, useMemo, useState } from 'react';
import { stocksAPI } from '../services/api';
import './stock-selector.css';

const INTERNATIONAL_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'META', name: 'Meta Platforms' },
];
const INDIAN_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
  { symbol: 'INFY.NS', name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
];

const TAB_KEYS = {
  INTERNATIONAL: 'international',
  INDIAN: 'indian',
};

const PRICE_PREFETCH_LIMIT = 24;
const PRICE_STALE_MS = 45 * 1000;

const formatPrice = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '--';
  }
  return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const fixed = numeric.toFixed(2);
  return `${numeric >= 0 ? '+' : ''}${fixed}%`;
};

const normalizeQuote = (payload) => {
  const currentPrice = Number(payload?.current_price ?? payload?.c);
  const previousClose = Number(payload?.previous_close ?? payload?.pc);
  const rawChange = payload?.change ?? payload?.d;
  const rawPercent = payload?.change_percent ?? payload?.dp;

  const change = Number.isFinite(Number(rawChange))
    ? Number(rawChange)
    : Number.isFinite(currentPrice) && Number.isFinite(previousClose)
    ? currentPrice - previousClose
    : null;

  const percent = Number.isFinite(Number(rawPercent))
    ? Number(rawPercent)
    : Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0
    ? (change / previousClose) * 100
    : null;

  return {
    price: Number.isFinite(currentPrice) ? currentPrice : null,
    change: Number.isFinite(change) ? change : null,
    percent: Number.isFinite(percent) ? percent : null,
    positive: Number.isFinite(change) ? change >= 0 : null,
  };
};

const StockSelector = ({ selectedStock, onSelectStock }) => {
  const [activeTab, setActiveTab] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [internationalStocks, setInternationalStocks] = useState(INTERNATIONAL_STOCKS);
  const [indianStocks, setIndianStocks] = useState(INDIAN_STOCKS);
  const [loading, setLoading] = useState(false);
  const [priceBySymbol, setPriceBySymbol] = useState({});

  useEffect(() => {
    if (String(selectedStock || '').endsWith('.NS')) {
      setActiveTab(TAB_KEYS.INDIAN);
      return;
    }
    setActiveTab(TAB_KEYS.INTERNATIONAL);
  }, [selectedStock]);

  const stocksForTab = useMemo(() => {
    if (activeTab === TAB_KEYS.INDIAN) {
      return indianStocks;
    }
    return internationalStocks;
  }, [activeTab, indianStocks, internationalStocks]);

  const filteredStocks = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return stocksForTab;
    }
    return stocksForTab.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(needle) ||
        String(stock.name || '').toLowerCase().includes(needle)
    );
  }, [searchTerm, stocksForTab]);

  useEffect(() => {
    let mounted = true;
    const loadStockLists = async () => {
      setLoading(true);
      try {
        const [internationalResponse, indianResponse] = await Promise.all([
          stocksAPI.getByMarket('US', 600),
          stocksAPI.getByMarket('IN', 600),
        ]);

        if (!mounted) {
          return;
        }

        const usStocks = internationalResponse.data?.stocks || [];
        const inStocks = indianResponse.data?.stocks || [];

        if (usStocks.length > 0) {
          setInternationalStocks(usStocks);
        }
        if (inStocks.length > 0) {
          setIndianStocks(inStocks);
        }
      } catch (error) {
        if (!mounted) {
          return;
        }
      }
      if (mounted) {
        setLoading(false);
      }
    };

    loadStockLists();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen || !activeTab) {
      return undefined;
    }

    const candidateSymbols = filteredStocks
      .slice(0, PRICE_PREFETCH_LIMIT)
      .map((stock) => String(stock.symbol || '').toUpperCase())
      .filter(Boolean);

    if (candidateSymbols.length === 0) {
      return undefined;
    }

    const now = Date.now();
    const toFetch = candidateSymbols.filter((symbol) => {
      const existing = priceBySymbol[symbol];
      if (!existing) {
        return true;
      }
      if (existing.status === 'loading') {
        return false;
      }
      return now - (existing.updatedAt || 0) > PRICE_STALE_MS;
    });

    if (toFetch.length === 0) {
      return undefined;
    }

    setPriceBySymbol((previous) => {
      const next = { ...previous };
      toFetch.forEach((symbol) => {
        next[symbol] = {
          ...(previous[symbol] || {}),
          status: 'loading',
        };
      });
      return next;
    });

    let cancelled = false;
    Promise.all(
      toFetch.map(async (symbol) => {
        try {
          const response = await stocksAPI.getPrice(symbol);
          return { symbol, ok: true, data: response.data };
        } catch (error) {
          return { symbol, ok: false };
        }
      })
    ).then((results) => {
      if (cancelled) {
        return;
      }
      const completedAt = Date.now();
      setPriceBySymbol((previous) => {
        const next = { ...previous };
        results.forEach((result) => {
          if (!result.ok) {
            next[result.symbol] = {
              ...(previous[result.symbol] || {}),
              status: 'error',
              updatedAt: completedAt,
            };
            return;
          }
          const normalized = normalizeQuote(result.data);
          next[result.symbol] = {
            status: 'ready',
            ...normalized,
            updatedAt: completedAt,
          };
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, filteredStocks, priceBySymbol]);

  const handleTabClick = (tabKey) => {
    if (activeTab === tabKey) {
      if (isOpen) {
        setIsOpen(false);
        setActiveTab(null);
        return;
      }
      setActiveTab(tabKey);
      setIsOpen(true);
      return;
    }

    setActiveTab(tabKey);
    setIsOpen(true);
  };

  return (
    <section className="stock-selector glass-card">
      <div className="stock-selector-tabs" role="tablist" aria-label="Stock market tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TAB_KEYS.INTERNATIONAL}
          aria-expanded={activeTab === TAB_KEYS.INTERNATIONAL ? isOpen : false}
          aria-controls="stock-selector-panel"
          className={`stock-selector-tab ${activeTab === TAB_KEYS.INTERNATIONAL ? 'active' : ''}`}
          onClick={() => handleTabClick(TAB_KEYS.INTERNATIONAL)}
        >
          INTERNATIONAL STOCKS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TAB_KEYS.INDIAN}
          aria-expanded={activeTab === TAB_KEYS.INDIAN ? isOpen : false}
          aria-controls="stock-selector-panel"
          className={`stock-selector-tab ${activeTab === TAB_KEYS.INDIAN ? 'active' : ''}`}
          onClick={() => handleTabClick(TAB_KEYS.INDIAN)}
        >
          INDIAN STOCKS
        </button>
      </div>

      <div
        id="stock-selector-panel"
        key={activeTab}
        className={`stock-selector-panel ${isOpen ? 'open' : 'closed'}`}
        aria-hidden={!isOpen}
      >
        <div className="stock-selector-search-wrap">
          <input
            type="text"
            className="stock-selector-search"
            placeholder={`Filter ${activeTab === TAB_KEYS.INDIAN ? 'Indian' : 'International'} stocks`}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <span className="stock-selector-count">
            {filteredStocks.length}
            {loading ? ' loading...' : ' listed'}
          </span>
        </div>
        <div className="stock-selector-scroll" role="listbox" aria-label={`${activeTab} stocks`}>
          {filteredStocks.length === 0 ? (
            <p className="stock-selector-empty">No stocks match "{searchTerm}"</p>
          ) : (
            filteredStocks.map((stock) => {
              const symbolKey = String(stock.symbol || '').toUpperCase();
              const quote = priceBySymbol[symbolKey];
              const percentText = formatPercent(quote?.percent);

              return (
                <button
                  key={stock.symbol}
                  type="button"
                  className={`stock-selector-item ${selectedStock === stock.symbol ? 'active' : ''}`}
                  onClick={() => onSelectStock(stock.symbol)}
                >
                  <strong>{stock.symbol}</strong>
                  <span>{stock.name}</span>
                  <div className="stock-selector-price-row">
                    {quote?.status === 'loading' ? (
                      <span className="stock-selector-price muted">Loading...</span>
                    ) : (
                      <span className="stock-selector-price">{formatPrice(quote?.price)}</span>
                    )}
                    {quote?.status === 'ready' && percentText ? (
                      <span className={`stock-selector-change ${quote?.positive ? 'positive' : 'negative'}`}>
                        {percentText}
                      </span>
                    ) : (
                      <span className="stock-selector-change muted">--</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default StockSelector;
