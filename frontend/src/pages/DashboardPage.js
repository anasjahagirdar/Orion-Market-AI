import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import CandlestickChart from '../components/CandlestickChart';
import FloatingChatbot from '../components/FloatingChatbot';
import MetricCard from '../components/MetricCard';
import SearchBar from '../components/SearchBar';
import SentimentCard from '../components/SentimentCard';
import StockSelector from '../components/StockSelector';
import { useAuth } from '../context/AuthContext';
import { newsAPI, stocksAPI } from '../services/api';
import './dashboard-page.css';

const parseSymbolFromSearch = (search) => {
  const query = new URLSearchParams(search);
  return query.get('stock');
};

const STOCK_SWITCH_DEBOUNCE_MS = 180;
const TOAST_THROTTLE_MS = 1200;
const PERIOD_OPTIONS = [
  { key: '1mo', label: '1 Month' },
  { key: '3mo', label: '3 Months' },
  { key: '6mo', label: '6 Months' },
  { key: '1y', label: '1 Year' },
];

const formatChartDateTick = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(5);
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTooltipDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatPrice = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '--';
  }
  return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
};

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockPrice, setStockPrice] = useState(null);
  const [linePeriod, setLinePeriod] = useState('1y');
  const [stockHistory, setStockHistory] = useState([]);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const stockPriceRequestRef = useRef(0);
  const lineChartRequestRef = useRef(0);
  const newsRequestRef = useRef(0);
  const stockSwitchTimeoutRef = useRef(null);
  const lastToastAtRef = useRef(0);

  const notifyRequestIssue = (error, fallbackMessage) => {
    const now = Date.now();
    if (now - lastToastAtRef.current < TOAST_THROTTLE_MS) {
      return;
    }

    const statusCode = error?.response?.status;
    if (statusCode === 429) {
      toast.error('API rate limit reached. Please wait and retry.');
    } else {
      toast.error(fallbackMessage);
    }
    lastToastAtRef.current = now;
  };

  const queueStockSelection = (symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    if (!normalized) {
      return;
    }

    if (stockSwitchTimeoutRef.current) {
      clearTimeout(stockSwitchTimeoutRef.current);
    }

    stockSwitchTimeoutRef.current = setTimeout(() => {
      setSelectedStock((previous) => (previous === normalized ? previous : normalized));
    }, STOCK_SWITCH_DEBOUNCE_MS);
  };

  useEffect(() => {
    const querySymbol = parseSymbolFromSearch(location.search);
    if (querySymbol && querySymbol.toUpperCase() !== selectedStock) {
      setSelectedStock(querySymbol.toUpperCase());
    }
  }, [location.search, selectedStock]);

  useEffect(() => {
    return () => {
      if (stockSwitchTimeoutRef.current) {
        clearTimeout(stockSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const requestId = stockPriceRequestRef.current + 1;
    stockPriceRequestRef.current = requestId;

    const loadPrice = async () => {
      try {
        const priceResponse = await stocksAPI.getPrice(selectedStock);
        if (requestId !== stockPriceRequestRef.current) {
          return;
        }
        setStockPrice(priceResponse.data || null);
      } catch (error) {
        if (requestId !== stockPriceRequestRef.current) {
          return;
        }
        setStockPrice(null);
        notifyRequestIssue(error, 'Failed to fetch stock price');
      }
    };

    loadPrice();
  }, [selectedStock]);

  useEffect(() => {
    const requestId = lineChartRequestRef.current + 1;
    lineChartRequestRef.current = requestId;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setStockHistory([]);
      try {
        const response = await stocksAPI.getHistory(selectedStock, linePeriod);
        if (requestId !== lineChartRequestRef.current) {
          return;
        }
        setStockHistory(response.data.history || []);
      } catch (error) {
        if (requestId !== lineChartRequestRef.current) {
          return;
        }
        setStockHistory([]);
        notifyRequestIssue(error, 'Failed to fetch line chart data');
      }
      if (requestId === lineChartRequestRef.current) {
        setLoading(false);
      }
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [selectedStock, linePeriod]);

  useEffect(() => {
    const requestId = newsRequestRef.current + 1;
    newsRequestRef.current = requestId;

    const timeoutId = setTimeout(async () => {
      setNewsLoading(true);
      try {
        const response = await newsAPI.getStockNews(selectedStock);
        if (requestId !== newsRequestRef.current) {
          return;
        }
        setNews(response.data.articles?.slice(0, 8) || []);
      } catch (error) {
        if (requestId !== newsRequestRef.current) {
          return;
        }
        setNews([]);
      }
      if (requestId === newsRequestRef.current) {
        setNewsLoading(false);
      }
    }, 140);

    return () => clearTimeout(timeoutId);
  }, [selectedStock]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const priceChange = useMemo(() => {
    if (!stockPrice?.current_price || !stockPrice?.previous_close) {
      return { change: 0, percent: 0, positive: true };
    }

    const change = Number((stockPrice.current_price - stockPrice.previous_close).toFixed(2));
    const percent = Number(((change / stockPrice.previous_close) * 100).toFixed(2));
    return { change, percent, positive: change >= 0 };
  }, [stockPrice]);

  const portfolioValue = useMemo(() => {
    if (!stockPrice?.current_price) {
      return '--';
    }
    return `$${(stockPrice.current_price * 128).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    })}`;
  }, [stockPrice]);

  const marketIndicators = useMemo(
    () => [
      {
        label: selectedStock,
        value: `${priceChange.positive ? '+' : ''}${priceChange.percent}%`,
        tone: priceChange.positive ? 'positive' : 'negative',
      },
      { label: 'S&P 500', value: '+0.84%', tone: 'positive' },
      { label: 'NIFTY 50', value: '-0.12%', tone: 'negative' },
    ],
    [selectedStock, priceChange]
  );

  const lineChartData = useMemo(
    () =>
      (stockHistory || [])
        .map((item) => ({
          ...item,
          close: Number(item.close),
        }))
        .filter((item) => item.date && Number.isFinite(item.close)),
    [stockHistory]
  );

  const lineChartDomain = useMemo(() => {
    if (!lineChartData.length) {
      return ['auto', 'auto'];
    }
    const values = lineChartData.map((item) => item.close);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = maxValue - minValue;
    const padding = Math.max(spread * 0.12, maxValue * 0.01, 0.5);
    return [Number((minValue - padding).toFixed(2)), Number((maxValue + padding).toFixed(2))];
  }, [lineChartData]);

  const lineGradientId = useMemo(
    () => `lineGradient-${String(selectedStock || 'stock').replace(/[^a-zA-Z0-9]/g, '')}`,
    [selectedStock]
  );

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Tracking ${selectedStock}`}
      activePath="/dashboard"
      user={user}
      onLogout={handleLogout}
      indicators={marketIndicators}
      portfolioValue={portfolioValue}
      headerExtra={
        <SearchBar
          onSelectStock={(stock) => queueStockSelection(stock.symbol)}
          placeholder="Search symbols, sectors, markets"
        />
      }
    >
      <StockSelector
        selectedStock={selectedStock}
        onSelectStock={queueStockSelection}
      />

      <div className="kpi-grid">
        <MetricCard
          label="Current Price"
          value={stockPrice?.current_price ? `$${stockPrice.current_price.toFixed(2)}` : '--'}
          subtitle={selectedStock}
        />
        <MetricCard
          label="Price Change"
          value={`${priceChange.positive ? '+' : ''}${priceChange.change}`}
          tone={priceChange.positive ? 'positive' : 'negative'}
          subtitle="Daily movement"
        />
        <MetricCard
          label="Percent Change"
          value={`${priceChange.positive ? '+' : ''}${priceChange.percent}%`}
          tone={priceChange.positive ? 'positive' : 'negative'}
          subtitle="vs previous close"
        />
        <MetricCard
          label="Volume"
          value={stockPrice?.volume ? `${(stockPrice.volume / 1000000).toFixed(1)}M` : '--'}
          tone="neutral"
          subtitle="Market participation"
        />
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card glass-card">
          <h3>{selectedStock} Price Trend</h3>
          <p className="dashboard-card-subtitle">
            {PERIOD_OPTIONS.find((item) => item.key === linePeriod)?.label} line chart
          </p>
          <div className="line-filters">
            {PERIOD_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`line-filter ${linePeriod === item.key ? 'active' : ''}`}
                onClick={() => setLinePeriod(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="chart-wrap">
            {loading ? (
              <p className="dashboard-empty">Loading chart...</p>
            ) : lineChartData.length === 0 ? (
              <p className="dashboard-empty">No chart data available for this timeframe.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineChartData}>
                  <defs>
                    <linearGradient id={lineGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(90, 139, 255, 0.42)" />
                      <stop offset="78%" stopColor="rgba(90, 139, 255, 0.06)" />
                      <stop offset="100%" stopColor="rgba(90, 139, 255, 0.01)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="rgba(136, 168, 209, 0.18)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9fb3d2', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickFormatter={formatChartDateTick}
                  />
                  <YAxis
                    tick={{ fill: '#9fb3d2', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={lineChartDomain}
                    width={70}
                    tickFormatter={(value) => formatPrice(value, 0)}
                  />
                  <Tooltip
                    formatter={(value) => [formatPrice(value), 'Close']}
                    labelFormatter={formatTooltipDate}
                    cursor={{ stroke: 'rgba(90, 139, 255, 0.6)', strokeDasharray: '3 3' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(136, 168, 209, 0.34)',
                      background: 'rgba(11, 19, 34, 0.95)',
                    }}
                  />
                  <Area
                    type="monotoneX"
                    dataKey="close"
                    stroke="none"
                    fill={`url(#${lineGradientId})`}
                  />
                  <Line
                    type="monotoneX"
                    dataKey="close"
                    stroke="#5a8bff"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 6,
                      stroke: '#0f1627',
                      strokeWidth: 2,
                      fill: '#f5c542',
                    }}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="dashboard-card glass-card">
          <CandlestickChart
            symbol={selectedStock}
            data={stockHistory}
            loading={loading}
            period={linePeriod}
            onPeriodChange={setLinePeriod}
          />
        </section>

        <section className="dashboard-card glass-card news-card">
          <h3>Market Headlines</h3>
          <p className="dashboard-card-subtitle">
            Dual API sentiment for {selectedStock} (Alpha Vantage + Finnhub)
          </p>
          {newsLoading ? (
            <p className="dashboard-empty">Loading sentiment headlines...</p>
          ) : news.length === 0 ? (
            <p className="dashboard-empty">
              No headlines available. Check API keys or try another symbol.
            </p>
          ) : (
            <ul className="news-list">
              {news.map((article, index) => (
                <SentimentCard key={`${article.url}-${index}`} article={article} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dashboard-banner">
        <div>
          <h3>Use Orion AI for deeper stock signals</h3>
          <p>Combine sentiment, trend, and sector context from one place.</p>
        </div>
        <button type="button" onClick={() => navigate('/chatbot')}>
          Open AI Analysis
        </button>
      </div>

      <FloatingChatbot />
    </AppShell>
  );
};

export default DashboardPage;
