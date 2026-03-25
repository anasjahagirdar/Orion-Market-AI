import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import MetricCard from '../components/MetricCard';
import { useAuth } from '../context/AuthContext';
import { portfolioAPI } from '../services/api';
import './portfolio-analysis-page.css';

const SECTOR_OPTIONS = [
  'General',
  'Financial Services',
  'Capital Goods',
  'Healthcare',
  'Automobile and Auto Components',
  'Fast Moving Consumer Goods',
  'Information Technology',
  'Consumer Services',
  'Power',
  'Metals & Mining',
  'Oil Gas & Consumable Fuels',
  'Consumer Durables',
  'Chemicals',
  'Realty',
  'Construction',
  'Telecommunication',
  'Services',
  'Textiles',
];

const CLUSTER_COLORS = ['#5A8BFF', '#2ECE86', '#F5C542', '#FF6B6B', '#A78BFA', '#22D3EE'];

const formatCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '--';
  }
  return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

const formatNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '--';
  }
  return numeric.toLocaleString('en-US');
};

const formatDateTime = (value) => {
  if (!value) {
    return '--';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const PortfolioAnalysisPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedSector, setSelectedSector] = useState('General');
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchSector = async () => {
      setLoading(true);
      try {
        const response = await portfolioAPI.getSector(selectedSector);
        if (!active) {
          return;
        }
        setPayload(response.data || null);
        setError('');
      } catch (requestError) {
        if (!active) {
          return;
        }
        const message =
          requestError?.response?.data?.error ||
          `Failed to load portfolio data for ${selectedSector}`;
        setError(message);
        setPayload(null);
        toast.error(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchSector();

    return () => {
      active = false;
    };
  }, [selectedSector]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const response = await portfolioAPI.recompute();
      const count = response?.data?.sector_count;
      toast.success(
        `Portfolio recomputed${Number.isFinite(count) ? ` (${count} sectors)` : ''}`
      );
      setLoading(true);
      const fresh = await portfolioAPI.getSectorFresh(selectedSector);
      setPayload(fresh.data || null);
      setError('');
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error ||
        'Portfolio recompute failed';
      toast.error(message);
    } finally {
      setLoading(false);
      setRecomputing(false);
    }
  };

  const stocks = useMemo(() => payload?.stocks ?? [], [payload]);
  const totalStocks = stocks.length;
  const avgPrice =
    stocks.length > 0
      ? stocks.reduce((sum, row) => sum + Number(row?.features?.price || 0), 0) / stocks.length
      : null;
  const avgDiscount =
    stocks.length > 0
      ? stocks.reduce((sum, row) => sum + Number(row?.features?.discount_price || 0), 0) / stocks.length
      : null;
  const avgPe =
    stocks.length > 0
      ? stocks.reduce((sum, row) => sum + Number(row?.features?.pe_ratio || 0), 0) / stocks.length
      : null;

  const clusterData = useMemo(
    () =>
      stocks
        .map((row) => ({
          symbol: row.symbol,
          price: Number(row?.features?.price),
          peRatio: Number(row?.features?.pe_ratio),
          cluster: Number(row?.cluster?.primary ?? 0),
        }))
        .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.peRatio)),
    [stocks]
  );

  const pcaData = useMemo(() => {
    const clusterLabels = payload?.cluster_labels?.primary || {};
    return (payload?.pca_values || [])
      .map((row) => ({
        symbol: row.symbol,
        pc1: Number(row.pc1),
        pc2: Number(row.pc2),
        cluster: Number(clusterLabels[row.symbol] ?? 0),
      }))
      .filter((row) => Number.isFinite(row.pc1) && Number.isFinite(row.pc2));
  }, [payload]);

  const discountPlotData = useMemo(
    () =>
      stocks
        .map((row) => {
          const price = Number(row?.features?.price);
          const discountPrice = Number(row?.features?.discount_price);
          return {
            symbol: row.symbol,
            price,
            discountPrice,
            discountGap: Number.isFinite(price) && Number.isFinite(discountPrice) ? price - discountPrice : 0,
          };
        })
        .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.discountPrice))
        .sort((a, b) => b.discountGap - a.discountGap)
        .slice(0, 15),
    [stocks]
  );

  const clusterCount = useMemo(() => {
    const values = new Set(stocks.map((row) => Number(row?.cluster?.primary ?? 0)));
    return values.size;
  }, [stocks]);

  const indicators = [
    { label: 'Sector', value: selectedSector, tone: 'neutral' },
    { label: 'Stocks', value: String(totalStocks), tone: 'positive' },
    { label: 'Clusters', value: String(clusterCount), tone: 'neutral' },
  ];

  const generatedAt = payload?.generated_at_utc ? formatDateTime(payload.generated_at_utc) : '--';

  return (
    <AppShell
      title="Portfolio Analysis"
      subtitle="Persistent sector portfolio outputs"
      activePath="/portfolio-analysis"
      user={user}
      onLogout={handleLogout}
      indicators={indicators}
      portfolioValue={avgPrice ? formatCurrency(avgPrice) : '--'}
    >
      <section className="portfolio-controls glass-card">
        <div>
          <h2>Sector Portfolio</h2>
          <p>Select a sector to load stored clustering and PCA output.</p>
        </div>
        <div className="portfolio-select-wrap">
          <label htmlFor="portfolio-sector">Sector</label>
          <select
            id="portfolio-sector"
            value={selectedSector}
            onChange={(event) => setSelectedSector(event.target.value)}
          >
            {SECTOR_OPTIONS.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="portfolio-recompute-btn"
            onClick={handleRecompute}
            disabled={recomputing}
          >
            {recomputing ? 'Recomputing...' : 'Recompute Portfolio'}
          </button>
          <span>Generated: {generatedAt}</span>
        </div>
      </section>

      <div className="kpi-grid">
        <MetricCard label="Total Stocks" value={String(totalStocks)} subtitle={selectedSector} />
        <MetricCard label="Avg Price" value={avgPrice ? formatCurrency(avgPrice) : '--'} subtitle="Sector mean" />
        <MetricCard label="Avg Discount Price" value={avgDiscount ? formatCurrency(avgDiscount) : '--'} subtitle="Stored output" />
        <MetricCard label="Avg PE Ratio" value={Number.isFinite(avgPe) ? avgPe.toFixed(2) : '--'} subtitle="Valuation baseline" />
      </div>

      {loading ? (
        <section className="glass-card portfolio-card">
          <p className="portfolio-state">Loading sector portfolio...</p>
        </section>
      ) : error ? (
        <section className="glass-card portfolio-card">
          <p className="portfolio-state error">{error}</p>
        </section>
      ) : (
        <div className="portfolio-grid">
          <section className="glass-card portfolio-card portfolio-table-card">
            <header>
              <h3>Stocks Table</h3>
              <span>{totalStocks} rows</span>
            </header>
            <div className="portfolio-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Market</th>
                    <th>Price</th>
                    <th>PE</th>
                    <th>Volume</th>
                    <th>Discount</th>
                    <th>Cluster</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((row) => (
                    <tr key={row.symbol}>
                      <td>{row.symbol}</td>
                      <td>{row.name}</td>
                      <td>{row.market}</td>
                      <td>{formatCurrency(row?.features?.price)}</td>
                      <td>{Number(row?.features?.pe_ratio || 0).toFixed(2)}</td>
                      <td>{formatNumber(row?.features?.volume)}</td>
                      <td>{formatCurrency(row?.features?.discount_price)}</td>
                      <td>{row?.cluster?.primary ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-card portfolio-card">
            <header>
              <h3>Cluster Plot</h3>
              <span>Price vs PE</span>
            </header>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(136,168,209,0.16)" />
                  <XAxis
                    type="number"
                    dataKey="price"
                    name="Price"
                    tick={{ fill: '#9fb3d2', fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="peRatio"
                    name="PE"
                    tick={{ fill: '#9fb3d2', fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(136,168,209,0.3)',
                      background: 'rgba(8,14,24,0.95)',
                    }}
                    formatter={(value, name) => [Number(value).toFixed(2), name]}
                    labelFormatter={(_, payloadRows) => payloadRows?.[0]?.payload?.symbol || ''}
                  />
                  <Scatter data={clusterData}>
                    {clusterData.map((entry, index) => (
                      <Cell key={`${entry.symbol}-${index}`} fill={CLUSTER_COLORS[entry.cluster % CLUSTER_COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass-card portfolio-card">
            <header>
              <h3>PCA Plot</h3>
              <span>PC1 vs PC2</span>
            </header>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(136,168,209,0.16)" />
                  <XAxis type="number" dataKey="pc1" tick={{ fill: '#9fb3d2', fontSize: 11 }} />
                  <YAxis type="number" dataKey="pc2" tick={{ fill: '#9fb3d2', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(136,168,209,0.3)',
                      background: 'rgba(8,14,24,0.95)',
                    }}
                    formatter={(value, name) => [Number(value).toFixed(4), name]}
                    labelFormatter={(_, payloadRows) => payloadRows?.[0]?.payload?.symbol || ''}
                  />
                  <Scatter data={pcaData}>
                    {pcaData.map((entry, index) => (
                      <Cell key={`${entry.symbol}-${index}`} fill={CLUSTER_COLORS[entry.cluster % CLUSTER_COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass-card portfolio-card">
            <header>
              <h3>Discount Plot</h3>
              <span>Top 15 discount gaps</span>
            </header>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={discountPlotData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(136,168,209,0.16)" />
                  <XAxis type="number" tick={{ fill: '#9fb3d2', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    width={78}
                    tick={{ fill: '#dce8ff', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(136,168,209,0.3)',
                      background: 'rgba(8,14,24,0.95)',
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="price" fill="#5A8BFF" name="Price" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="discountPrice" fill="#F5C542" name="Discount Price" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
};

export default PortfolioAnalysisPage;
