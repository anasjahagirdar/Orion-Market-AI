import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import MetricCard from '../components/MetricCard';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import { stocksAPI } from '../services/api';
import './watchlist-page.css';

const WatchlistPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchlist = async () => {
      setLoading(true);
      try {
        const response = await stocksAPI.getWatchlist();
        const items = response.data.watchlist || [];
        setWatchlist(items);

        const priceData = {};
        await Promise.allSettled(
          items.map(async (item) => {
            try {
              const priceResponse = await stocksAPI.getPrice(item.symbol);
              priceData[item.symbol] = priceResponse.data;
            } catch (error) {
              priceData[item.symbol] = null;
            }
          })
        );
        setPrices(priceData);
      } catch (error) {
        toast.error('Failed to load watchlist');
      }
      setLoading(false);
    };

    fetchWatchlist();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAdd = async (stock) => {
    try {
      const response = await stocksAPI.addToWatchlist(stock.symbol);
      toast.success(response.data.message);

      const updated = await stocksAPI.getWatchlist();
      setWatchlist(updated.data.watchlist || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add stock');
    }
  };

  const handleRemove = async (symbol) => {
    try {
      await stocksAPI.removeFromWatchlist(symbol);
      setWatchlist((previous) => previous.filter((item) => item.symbol !== symbol));
      setPrices((previous) => {
        const next = { ...previous };
        delete next[symbol];
        return next;
      });
      toast.success(`${symbol} removed from watchlist`);
    } catch (error) {
      toast.error('Failed to remove stock');
    }
  };

  const getChange = (priceInfo) => {
    if (!priceInfo?.current_price || !priceInfo?.previous_close) {
      return { change: null, percent: null, positive: true };
    }
    const delta = priceInfo.current_price - priceInfo.previous_close;
    return {
      change: delta.toFixed(2),
      percent: ((delta / priceInfo.previous_close) * 100).toFixed(2),
      positive: delta >= 0,
    };
  };

  const usCount = watchlist.filter((stock) => stock.market === 'US').length;
  const inCount = watchlist.filter((stock) => stock.market === 'IN').length;

  const positiveMoves = useMemo(() => {
    return watchlist.reduce((count, stock) => {
      const move = getChange(prices[stock.symbol]);
      return move.change !== null && move.positive ? count + 1 : count;
    }, 0);
  }, [watchlist, prices]);

  const indicators = [
    { label: 'Tracked', value: `${watchlist.length}`, tone: 'neutral' },
    { label: 'US', value: `${usCount}`, tone: 'positive' },
    { label: 'IN', value: `${inCount}`, tone: 'neutral' },
  ];

  return (
    <AppShell
      title="Watchlist"
      subtitle="Real-time stocks you are tracking"
      activePath="/watchlist"
      user={user}
      onLogout={handleLogout}
      indicators={indicators}
      portfolioValue={`$${(watchlist.length * 12450).toLocaleString('en-US')}`}
    >
      <div className="watchlist-header">
        <div>
          <h2>Track and react faster</h2>
          <p>Monitor daily movement and remove noise from your stock list.</p>
        </div>
        <div className="watchlist-search">
          <SearchBar onSelectStock={handleAdd} placeholder="Add stock to watchlist" />
        </div>
      </div>

      <div className="kpi-grid">
        <MetricCard label="Total Stocks" value={`${watchlist.length}`} subtitle="Current list size" />
        <MetricCard label="US Exposure" value={`${usCount}`} subtitle="US market symbols" />
        <MetricCard label="Indian Exposure" value={`${inCount}`} subtitle="IN market symbols" />
        <MetricCard
          label="Green Moves"
          value={`${positiveMoves}`}
          tone="positive"
          subtitle="Positive daily change"
        />
      </div>

      <section className="watchlist-table-card glass-card">
        {loading ? (
          <p className="watchlist-empty">Loading watchlist...</p>
        ) : watchlist.length === 0 ? (
          <p className="watchlist-empty">Your watchlist is empty. Use search to add stocks.</p>
        ) : (
          <>
            <div className="watchlist-table-head">
              <span>Stock</span>
              <span>Market</span>
              <span>Price</span>
              <span>Change</span>
              <span>Change %</span>
              <span>Volume</span>
              <span>Action</span>
            </div>
            {watchlist.map((item) => {
              const priceInfo = prices[item.symbol];
              const move = getChange(priceInfo);
              return (
                <div key={item.symbol} className="watchlist-table-row">
                  <button
                    type="button"
                    className="watchlist-stock"
                    onClick={() => navigate(`/dashboard?stock=${item.symbol}`)}
                  >
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </button>
                  <span className={`market-badge ${item.market?.toLowerCase()}`}>{item.market}</span>
                  <span>
                    {priceInfo?.current_price ? `$${Number(priceInfo.current_price).toFixed(2)}` : '--'}
                  </span>
                  <span className={move.change !== null && move.positive ? 'watchlist-change-positive' : 'watchlist-change-negative'}>
                    {move.change === null ? '--' : `${move.positive ? '+' : ''}${move.change}`}
                  </span>
                  <span className={move.percent !== null && move.positive ? 'watchlist-change-positive' : 'watchlist-change-negative'}>
                    {move.percent === null ? '--' : `${move.positive ? '+' : ''}${move.percent}%`}
                  </span>
                  <span>{priceInfo?.volume ? `${(priceInfo.volume / 1000000).toFixed(1)}M` : '--'}</span>
                  <button
                    type="button"
                    className="watchlist-remove-btn"
                    onClick={() => handleRemove(item.symbol)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </>
        )}
      </section>
    </AppShell>
  );
};

export default WatchlistPage;
