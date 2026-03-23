import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stocksAPI } from '../services/api';
import SearchBar from '../components/SearchBar';
import toast from 'react-hot-toast';

const WatchlistPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await stocksAPI.getWatchlist();
      const items = res.data.watchlist || [];
      setWatchlist(items);
      // Fetch prices for all watchlist stocks
      fetchPrices(items);
    } catch (error) {
      toast.error('Failed to load watchlist');
    }
    setLoading(false);
  };

  const fetchPrices = async (items) => {
    const priceData = {};
    await Promise.allSettled(
      items.map(async (item) => {
        try {
          const res = await stocksAPI.getPrice(item.symbol);
          priceData[item.symbol] = res.data;
        } catch {
          priceData[item.symbol] = null;
        }
      })
    );
    setPrices(priceData);
  };

  const handleAdd = async (stock) => {
    try {
      const res = await stocksAPI.addToWatchlist(stock.symbol);
      toast.success(res.data.message);
      fetchWatchlist();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add stock');
    }
  };

  const handleRemove = async (symbol) => {
    try {
      await stocksAPI.removeFromWatchlist(symbol);
      toast.success(`${symbol} removed from watchlist`);
      setWatchlist((prev) => prev.filter((s) => s.symbol !== symbol));
    } catch (error) {
      toast.error('Failed to remove stock');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getChange = (priceInfo) => {
    if (!priceInfo?.current_price || !priceInfo?.previous_close) {
      return { change: null, percent: null, positive: true };
    }
    const change = priceInfo.current_price - priceInfo.previous_close;
    const percent = (change / priceInfo.previous_close) * 100;
    return {
      change: change.toFixed(2),
      percent: percent.toFixed(2),
      positive: change >= 0,
    };
  };

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
                ...(item.path === '/watchlist' ? styles.activeNavItem : {}),
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

      {/* Main */}
      <div style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.headerTitle}>⭐ My Watchlist</h2>
            <p style={styles.headerSub}>
              {watchlist.length} stock{watchlist.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <div style={styles.searchWrapper}>
            <SearchBar onSelectStock={handleAdd} />
          </div>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <div style={styles.statPill}>
            <span style={styles.statPillLabel}>Total Stocks</span>
            <span style={styles.statPillValue}>{watchlist.length}</span>
          </div>
          <div style={styles.statPill}>
            <span style={styles.statPillLabel}>US Stocks</span>
            <span style={styles.statPillValue}>
              {watchlist.filter((s) => s.market === 'US').length}
            </span>
          </div>
          <div style={styles.statPill}>
            <span style={styles.statPillLabel}>Indian Stocks</span>
            <span style={styles.statPillValue}>
              {watchlist.filter((s) => s.market === 'IN').length}
            </span>
          </div>
        </div>

        {/* Watchlist Table */}
        {loading ? (
          <div style={styles.emptyState}>Loading your watchlist...</div>
        ) : watchlist.length === 0 ? (
          <div style={styles.emptyCard}>
            <p style={styles.emptyIcon}>⭐</p>
            <p style={styles.emptyTitle}>Your watchlist is empty</p>
            <p style={styles.emptyText}>
              Use the search bar above to find and add stocks
            </p>
          </div>
        ) : (
          <div style={styles.tableCard}>
            {/* Table Header */}
            <div style={styles.tableHeader}>
              <span style={{ ...styles.tableCell, flex: 2 }}>Stock</span>
              <span style={styles.tableCell}>Market</span>
              <span style={styles.tableCell}>Price</span>
              <span style={styles.tableCell}>Change</span>
              <span style={styles.tableCell}>Change %</span>
              <span style={styles.tableCell}>Volume</span>
              <span style={styles.tableCell}>Action</span>
            </div>

            {/* Table Rows */}
            {watchlist.map((item) => {
              const priceInfo = prices[item.symbol];
              const chg = getChange(priceInfo);
              return (
                <div key={item.symbol} style={styles.tableRow}>
                  {/* Stock Info */}
                  <div style={{ ...styles.tableCell, flex: 2 }}>
                    <div
                      style={styles.stockInfo}
                      onClick={() => navigate(`/dashboard?stock=${item.symbol}`)}
                    >
                      <span style={styles.stockSymbol}>{item.symbol}</span>
                      <span style={styles.stockName}>{item.name}</span>
                    </div>
                  </div>

                  {/* Market */}
                  <div style={styles.tableCell}>
                    <span style={{
                      ...styles.marketBadge,
                      background: item.market === 'US'
                        ? 'rgba(0,212,170,0.15)'
                        : 'rgba(255,165,0,0.15)',
                      color: item.market === 'US' ? '#00d4aa' : '#ffa500',
                    }}>
                      {item.market}
                    </span>
                  </div>

                  {/* Price */}
                  <div style={styles.tableCell}>
                    <span style={styles.priceValue}>
                      {priceInfo?.current_price
                        ? `$${priceInfo.current_price.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>

                  {/* Change */}
                  <div style={styles.tableCell}>
                    <span style={{
                      color: chg.change === null
                        ? 'rgba(255,255,255,0.3)'
                        : chg.positive ? '#00d4aa' : '#ff4d4d',
                    }}>
                      {chg.change === null
                        ? '—'
                        : `${chg.positive ? '+' : ''}${chg.change}`}
                    </span>
                  </div>

                  {/* Change % */}
                  <div style={styles.tableCell}>
                    <span style={{
                      ...styles.changeBadge,
                      background: chg.percent === null
                        ? 'rgba(255,255,255,0.05)'
                        : chg.positive
                          ? 'rgba(0,212,170,0.15)'
                          : 'rgba(255,77,77,0.15)',
                      color: chg.percent === null
                        ? 'rgba(255,255,255,0.3)'
                        : chg.positive ? '#00d4aa' : '#ff4d4d',
                    }}>
                      {chg.percent === null
                        ? '—'
                        : `${chg.positive ? '+' : ''}${chg.percent}%`}
                    </span>
                  </div>

                  {/* Volume */}
                  <div style={styles.tableCell}>
                    <span style={styles.volumeValue}>
                      {priceInfo?.volume
                        ? `${(priceInfo.volume / 1000000).toFixed(1)}M`
                        : '—'}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <div style={styles.tableCell}>
                    <button
                      style={styles.removeBtn}
                      onClick={() => handleRemove(item.symbol)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    gap: '20px',
  },
  headerTitle: { fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 },
  searchWrapper: { width: '400px' },
  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  statPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
  },
  statPillLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '13px' },
  statPillValue: { color: '#fff', fontWeight: '700', fontSize: '18px' },
  emptyState: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    padding: '60px',
    fontSize: '15px',
  },
  emptyCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '60px',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: '48px', margin: '0 0 16px 0' },
  emptyTitle: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0',
  },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 },
  tableCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    padding: '12px 20px',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  tableRow: {
    display: 'flex',
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    alignItems: 'center',
    transition: 'background 0.15s',
  },
  tableCell: {
    flex: 1,
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
  },
  stockInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    cursor: 'pointer',
  },
  stockSymbol: { color: '#fff', fontWeight: '600', fontSize: '14px' },
  stockName: { color: 'rgba(255,255,255,0.35)', fontSize: '11px' },
  marketBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
  },
  priceValue: { color: '#fff', fontWeight: '600', fontSize: '14px' },
  changeBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  volumeValue: { color: 'rgba(255,255,255,0.5)', fontSize: '13px' },
  removeBtn: {
    padding: '5px 12px',
    background: 'rgba(255,77,77,0.1)',
    border: '1px solid rgba(255,77,77,0.25)',
    borderRadius: '6px',
    color: '#ff4d4d',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

export default WatchlistPage;