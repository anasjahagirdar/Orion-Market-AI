import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stocksAPI, newsAPI } from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import SearchBar from '../components/SearchBar';

const TRACKED_STOCKS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'RELIANCE.NS', 'TCS.NS'];

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockPrice, setStockPrice] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStockData(selectedStock);
    fetchNews();
  }, [selectedStock]);

  const fetchStockData = async (symbol) => {
    setLoading(true);
    try {
      const [priceRes, historyRes] = await Promise.all([
        stocksAPI.getPrice(symbol),
        stocksAPI.getHistory(symbol, '1mo'),
      ]);
      setStockPrice(priceRes.data);
      setStockHistory(historyRes.data.history || []);
    } catch (error) {
      toast.error('Failed to fetch stock data');
    }
    setLoading(false);
  };

  const fetchNews = async () => {
    try {
      const res = await newsAPI.getAll();
      setNews(res.data.articles?.slice(0, 8) || []);
    } catch (error) {
      console.log('News fetch failed:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getPriceChange = () => {
    if (!stockPrice) return { change: 0, percent: 0, positive: true };
    const change = (stockPrice.current_price - stockPrice.previous_close).toFixed(2);
    const percent = ((change / stockPrice.previous_close) * 100).toFixed(2);
    return { change, percent, positive: change >= 0 };
  };

  const priceChange = getPriceChange();

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <span>📈</span>
          <span style={styles.sidebarLogoText}>Orion</span>
        </div>
        <nav style={styles.nav}>
          {[
            { icon: '📊', label: 'Dashboard', path: '/dashboard' },
            { icon: '⭐', label: 'Watchlist', path: '/watchlist' },
            { icon: '🤖', label: 'AI Chatbot', path: '/chatbot' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                ...styles.navItem,
                ...(item.path === '/dashboard' ? styles.activeNavItem : {}),
              }}
              onClick={() => navigate(item.path)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={styles.sidebarBottom}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={styles.username}>{user?.username || 'Guest'}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <h2 style={styles.headerTitle}>Market Dashboard</h2>
            <SearchBar onSelectStock={(stock) => setSelectedStock(stock.symbol)} />
          </div>
          <div style={styles.stockTabs}>
            {TRACKED_STOCKS.map((symbol) => (
              <button
                key={symbol}
                style={{
                  ...styles.stockTab,
                  ...(selectedStock === symbol ? styles.activeStockTab : {}),
                }}
                onClick={() => setSelectedStock(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Current Price</p>
            <p style={styles.statValue}>
              ${stockPrice?.current_price?.toFixed(2) || '---'}
            </p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Change</p>
            <p style={{ ...styles.statValue, color: priceChange.positive ? '#00d4aa' : '#ff4d4d' }}>
              {priceChange.positive ? '+' : ''}{priceChange.change}
            </p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Change %</p>
            <p style={{ ...styles.statValue, color: priceChange.positive ? '#00d4aa' : '#ff4d4d' }}>
              {priceChange.positive ? '+' : ''}{priceChange.percent}%
            </p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Volume</p>
            <p style={styles.statValue}>
              {stockPrice?.volume ? (stockPrice.volume / 1000000).toFixed(1) + 'M' : '---'}
            </p>
          </div>
        </div>

        {/* Chart + News */}
        <div style={styles.contentGrid}>
          {/* Price Chart */}
          <div style={styles.chartCard}>
            <h3 style={styles.cardTitle}>
              {selectedStock} — Price History (1 Month)
            </h3>
            {loading ? (
              <div style={styles.loading}>Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stockHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a2e',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#6c63ff"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* News Feed */}
          <div style={styles.newsCard}>
            <h3 style={styles.cardTitle}>📰 Stock Market News</h3>
            <div style={styles.newsList}>
              {news.length === 0 ? (
                <p style={styles.noData}>Add NEWS_API_KEY in .env to see live news</p>
              ) : (
                news.map((article, i) => (
                  <div
                    key={i}
                    onClick={() => window.open(article.url, '_blank')}
                    style={styles.newsItem}
                  >
                    <div style={styles.newsContent}>
                      <p style={styles.newsTitle}>{article.title}</p>
                      <div style={styles.newsMeta}>
                        <span style={styles.newsSourceBadge}>{article.source}</span>
                        <span style={styles.newsDate}>
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                            : ''}
                        </span>
                      </div>
                    </div>
                    <span style={styles.newsArrow}>›</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Go to Chatbot */}
        <div style={styles.chatbotBanner}>
          <div>
            <h3 style={styles.bannerTitle}>🤖 Ask Orion AI</h3>
            <p style={styles.bannerText}>Get AI-powered insights on any stock</p>
          </div>
          <button style={styles.bannerBtn} onClick={() => navigate('/chatbot')}>
            Open Chatbot →
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0a0a1a',
    color: '#fff',
  },
  sidebar: {
    width: '220px',
    background: 'rgba(255,255,255,0.03)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    flexShrink: 0,
  },
  sidebarLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '22px',
    marginBottom: '32px',
    paddingLeft: '8px',
  },
  sidebarLogoText: { fontWeight: '700', color: '#fff', fontSize: '20px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  activeNavItem: {
    background: 'rgba(108,99,255,0.15)',
    color: '#6c63ff',
  },
  sidebarBottom: { marginTop: 'auto' },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    marginBottom: '10px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#6c63ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
  },
  username: { color: '#fff', fontSize: '13px', fontWeight: '500' },
  logoutBtn: {
    width: '100%',
    padding: '9px',
    background: 'rgba(255,77,77,0.15)',
    border: '1px solid rgba(255,77,77,0.3)',
    borderRadius: '8px',
    color: '#ff4d4d',
    cursor: 'pointer',
    fontSize: '13px',
  },
  main: { flex: 1, padding: '24px', overflowY: 'auto' },
  header: { marginBottom: '24px' },
  headerTitle: { fontSize: '22px', fontWeight: '700', margin: '0' },
  stockTabs: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  stockTab: {
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '13px',
  },
   headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    marginBottom: '16px',
  },
  activeStockTab: {
    background: '#6c63ff',
    border: '1px solid #6c63ff',
    color: '#fff',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '20px',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    margin: '0 0 8px 0',
  },
  statValue: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: '700',
    margin: 0,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  },
  chartCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '20px',
  },
  newsCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '20px',
    overflowY: 'auto',
    maxHeight: '380px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '16px',
    color: 'rgba(255,255,255,0.9)',
  },
  loading: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    padding: '40px',
  },
  noData: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px',
  },
  newsList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  newsItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.05)',
    transition: 'all 0.2s',
  },
  newsContent: { flex: 1 },
  newsTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '12px',
    marginBottom: '6px',
    margin: '0 0 6px 0',
    lineHeight: '1.4',
  },
  newsMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px',
  },
  newsSourceBadge: {
    background: 'rgba(108,99,255,0.15)',
    color: '#6c63ff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
  },
  newsDate: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '11px',
  },
  newsArrow: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: '20px',
    flexShrink: 0,
    marginLeft: '8px',
  },
  chatbotBanner: {
    background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(61,53,181,0.2))',
    border: '1px solid rgba(108,99,255,0.3)',
    borderRadius: '12px',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: { fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' },
  bannerText: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 },
  bannerBtn: {
    padding: '10px 20px',
    background: '#6c63ff',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  },
};

export default DashboardPage;