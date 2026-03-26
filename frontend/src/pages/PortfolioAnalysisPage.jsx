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
import AppShell from '../components/layout/AppShell';
import MetricBox from '../components/ui/MetricBox';
import { useAuth } from '../context/AuthContext';
import { portfolioAPI } from '../services/api';
import '../styles/pages/portfolio-analysis-page.css';

const SECTOR_FALLBACK = [
  'Automobile and Auto Components',
  'Capital Goods',
  'Chemicals',
  'Construction',
  'Construction Materials',
  'Consumer Durables',
  'Consumer Services',
  'Fast Moving Consumer Goods',
  'Financial Services',
  'Healthcare',
  'Information Technology',
  'Metals & Mining',
  'Oil Gas & Consumable Fuels',
  'Power',
  'Realty',
  'Services',
  'Telecommunication',
  'Textiles',
];
const MARKET_OPTIONS = [
  { key: 'indian', label: 'Indian Markets' },
  { key: 'international', label: 'International Markets' },
];

const CLUSTER_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444', '#A78BFA', '#34D399', '#FBBF24', '#64748B'];
const FEATURE_CONFIG = [
  { key: 'price', label: 'Price' },
  { key: 'pe_ratio', label: 'PE Ratio' },
  { key: 'volume', label: 'Volume' },
  { key: 'discount_price', label: 'Discount Price' },
];

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

const calculateCorrelation = (seriesX, seriesY) => {
  const n = Math.min(seriesX.length, seriesY.length);
  if (n < 2) {
    return 0;
  }

  const meanX = seriesX.reduce((sum, value) => sum + value, 0) / n;
  const meanY = seriesY.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = seriesX[index] - meanX;
    const dy = seriesY[index] - meanY;
    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }

  if (denominatorX === 0 || denominatorY === 0) {
    return 0;
  }
  return numerator / Math.sqrt(denominatorX * denominatorY);
};

const PortfolioAnalysisPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedMarket, setSelectedMarket] = useState('indian');
  const [selectedSector, setSelectedSector] = useState('');
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [sectorOptionsByMarket, setSectorOptionsByMarket] = useState({
    indian: [],
    international: [],
  });

  const sectorsForMarket = useMemo(
    () => sectorOptionsByMarket[selectedMarket] || [],
    [selectedMarket, sectorOptionsByMarket]
  );

  useEffect(() => {
    if (!sectorsForMarket.includes(selectedSector)) {
      setSelectedSector('');
    }
  }, [sectorsForMarket, selectedSector]);

  useEffect(() => {
    setSelectedSector('');
    setPayload(null);
    setError('');
  }, [selectedMarket]);

  useEffect(() => {
    let active = true;

    const fetchSectors = async () => {
      try {
        const response = await portfolioAPI.getSectors(selectedMarket);
        if (!active) {
          return;
        }
        const sectorList = Array.isArray(response?.data?.sectors)
          ? response.data.sectors
          : [];
        setSectorOptionsByMarket((previous) => ({
          ...previous,
          [selectedMarket]: sectorList,
        }));
      } catch (requestError) {
        if (!active) {
          return;
        }
        setSectorOptionsByMarket((previous) => ({
          ...previous,
          [selectedMarket]: SECTOR_FALLBACK,
        }));
        const message =
          requestError?.response?.data?.error ||
          `Failed to load sectors for ${selectedMarket}`;
        toast.error(message);
      }
    };

    fetchSectors();
    return () => {
      active = false;
    };
  }, [selectedMarket]);

  useEffect(() => {
    if (!selectedSector) {
      setLoading(false);
      setPayload(null);
      setError('');
      return () => {};
    }
    let active = true;

    const fetchSector = async () => {
      setLoading(true);
      try {
        const response = await portfolioAPI.getSector(selectedMarket, selectedSector);
        if (!active) {
          return;
        }
        setPayload(response.data || null);
        setError('');
      } catch (requestError) {
        if (!active) {
          return;
        }
        const apiErrorData = requestError?.response?.data;
        const message =
          (typeof apiErrorData?.message === 'string' && apiErrorData.message) ||
          (typeof apiErrorData?.error === 'string' && apiErrorData.error) ||
          `Failed to load portfolio data for ${selectedMarket}/${selectedSector}`;
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
  }, [selectedMarket, selectedSector]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const response = await portfolioAPI.recompute(selectedMarket);
      const count = response?.data?.sector_count;
      toast.success(
        `${selectedMarket === 'indian' ? 'Indian' : 'International'} portfolio recomputed${
          Number.isFinite(count) ? ` (${count} sectors)` : ''
        }`
      );
      if (selectedSector) {
        setLoading(true);
        const fresh = await portfolioAPI.getSectorFresh(selectedMarket, selectedSector);
        setPayload(fresh.data || null);
        setError('');
      } else {
        setPayload(null);
        setError('');
      }
    } catch (requestError) {
      const apiErrorData = requestError?.response?.data;
      const message =
        (typeof apiErrorData?.message === 'string' && apiErrorData.message) ||
        (typeof apiErrorData?.error === 'string' && apiErrorData.error) ||
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

  const clusterLegendData = useMemo(() => {
    const buckets = new Map();
    stocks.forEach((row) => {
      const clusterId = Number(row?.cluster?.primary ?? 0);
      buckets.set(clusterId, (buckets.get(clusterId) || 0) + 1);
    });
    return Array.from(buckets.entries())
      .map(([clusterId, count]) => ({ clusterId, count }))
      .sort((a, b) => a.clusterId - b.clusterId);
  }, [stocks]);

  const featureImportanceData = useMemo(() => {
    if (!stocks.length) {
      return [];
    }

    const perCluster = new Map();
    stocks.forEach((row) => {
      const clusterId = Number(row?.cluster?.primary ?? 0);
      if (!perCluster.has(clusterId)) {
        perCluster.set(clusterId, []);
      }
      perCluster.get(clusterId).push(row);
    });

    const rawScores = FEATURE_CONFIG.map((feature) => {
      const means = [];
      perCluster.forEach((rows) => {
        const values = rows
          .map((row) => Number(row?.features?.[feature.key]))
          .filter((value) => Number.isFinite(value));
        if (values.length > 0) {
          const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
          means.push(mean);
        }
      });
      const spread = means.length > 1 ? Math.max(...means) - Math.min(...means) : 0;
      return { ...feature, rawScore: Number.isFinite(spread) ? spread : 0 };
    });

    const maxRaw = Math.max(...rawScores.map((row) => row.rawScore), 0);
    return rawScores
      .map((row) => ({
        feature: row.label,
        score: maxRaw > 0 ? (row.rawScore / maxRaw) * 100 : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [stocks]);

  const correlationHeatmap = useMemo(() => {
    const validRows = stocks.map((row) => row?.features || {});
    return FEATURE_CONFIG.flatMap((rowFeature) =>
      FEATURE_CONFIG.map((colFeature) => {
        const valuesX = [];
        const valuesY = [];
        validRows.forEach((features) => {
          const x = Number(features?.[colFeature.key]);
          const y = Number(features?.[rowFeature.key]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            valuesX.push(x);
            valuesY.push(y);
          }
        });
        const correlation = calculateCorrelation(valuesX, valuesY);
        return {
          key: `${rowFeature.key}-${colFeature.key}`,
          row: rowFeature.label,
          col: colFeature.label,
          value: Number.isFinite(correlation) ? correlation : 0,
        };
      })
    );
  }, [stocks]);

  const indicators = [
    { label: 'Market', value: selectedMarket === 'indian' ? 'Indian' : 'International', tone: 'neutral' },
    { label: 'Sector', value: selectedSector || 'Not selected', tone: 'neutral' },
    { label: 'Stocks', value: String(totalStocks), tone: 'positive' },
    { label: 'Clusters', value: String(clusterCount), tone: 'neutral' },
  ];

  const generatedAt = payload?.generated_at_utc ? formatDateTime(payload.generated_at_utc) : '--';

  return (
    <AppShell
      title="Portfolio Analysis"
      subtitle="Persistent sector portfolio outputs by market"
      activePath="/portfolio-analysis"
      user={user}
      onLogout={handleLogout}
      indicators={indicators}
      portfolioValue={avgPrice ? formatCurrency(avgPrice) : '--'}
    >
      <section className="portfolio-controls glass-card card-enter">
        <div>
          <h2>Sector Portfolio</h2>
          <p>Select a sector to load stored clustering and PCA output.</p>
          <div className="portfolio-market-tabs">
            {MARKET_OPTIONS.map((market) => (
              <button
                key={market.key}
                type="button"
                className={`btn-press ${selectedMarket === market.key ? `active ${market.key}` : market.key}`}
                onClick={() => setSelectedMarket(market.key)}
              >
                {market.label}
              </button>
            ))}
          </div>
        </div>
        <div className="portfolio-select-wrap">
          <label htmlFor="portfolio-sector">Sector</label>
          <select
            id="portfolio-sector"
            value={selectedSector}
            onChange={(event) => setSelectedSector(event.target.value)}
          >
            <option value="">-- Select a Sector --</option>
            {sectorsForMarket.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="portfolio-recompute-btn btn-press"
            onClick={handleRecompute}
            disabled={recomputing}
          >
            {recomputing ? 'Recomputing...' : 'Recompute Portfolio'}
          </button>
          <span>Generated: {generatedAt}</span>
        </div>
      </section>

      <div className="kpi-grid">
        <MetricBox label="Total Stocks" value={String(totalStocks)} subtitle={selectedSector || 'No sector selected'} />
        <MetricBox label="Avg Price" value={avgPrice ? formatCurrency(avgPrice) : '--'} subtitle="Sector mean" />
        <MetricBox label="Avg Discount Price" value={avgDiscount ? formatCurrency(avgDiscount) : '--'} subtitle="Stored output" />
        <MetricBox label="Avg PE Ratio" value={Number.isFinite(avgPe) ? avgPe.toFixed(2) : '--'} subtitle="Valuation baseline" />
      </div>

      {!selectedSector ? (
        <section className="glass-card portfolio-card card-enter">
          <p className="portfolio-state">Select a sector to load portfolio output.</p>
        </section>
      ) : loading ? (
        <section className="glass-card portfolio-card card-enter">
          <div className="portfolio-loading-stack">
            <div className="skeleton portfolio-skeleton-head" />
            <div className="skeleton portfolio-skeleton-chart" />
            <div className="skeleton portfolio-skeleton-row" />
            <div className="skeleton portfolio-skeleton-row short" />
          </div>
        </section>
      ) : error ? (
        <section className="glass-card portfolio-card card-enter">
          <p className="portfolio-state error">{error}</p>
        </section>
      ) : (
        <div className="portfolio-grid">
          <section className="glass-card portfolio-card portfolio-table-card card-enter">
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

          <section className="glass-card portfolio-card card-enter">
            <header>
              <h3>Cluster Plot</h3>
              <span>Price vs PE</span>
            </header>
            <div className="cluster-legend">
              {clusterLegendData.map((item) => (
                <span key={`cluster-${item.clusterId}`} className="cluster-legend-item">
                  <i style={{ backgroundColor: CLUSTER_COLORS[item.clusterId % CLUSTER_COLORS.length] }} />
                  C{item.clusterId}: {item.count}
                </span>
              ))}
            </div>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(99,179,237,0.08)" />
                  <XAxis
                    type="number"
                    dataKey="price"
                    name="Price"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="peRatio"
                    name="PE"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(99,179,237,0.18)',
                      background: '#111C30',
                    }}
                    formatter={(value, name) => [Number(value).toFixed(2), name]}
                    labelFormatter={(_, payloadRows) => {
                      const row = payloadRows?.[0]?.payload;
                      if (!row) {
                        return '';
                      }
                      return `${row.symbol} (Cluster ${row.cluster})`;
                    }}
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

          <section className="glass-card portfolio-card card-enter">
            <header>
              <h3>PCA Plot</h3>
              <span>PC1 vs PC2</span>
            </header>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(99,179,237,0.08)" />
                  <XAxis type="number" dataKey="pc1" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis type="number" dataKey="pc2" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(99,179,237,0.18)',
                      background: '#111C30',
                    }}
                    formatter={(value, name) => [Number(value).toFixed(4), name]}
                    labelFormatter={(_, payloadRows) => {
                      const row = payloadRows?.[0]?.payload;
                      if (!row) {
                        return '';
                      }
                      return `${row.symbol} (Cluster ${row.cluster})`;
                    }}
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

          <section className="glass-card portfolio-card card-enter">
            <header>
              <h3>Cluster Feature Importance</h3>
              <span>Spread-based ranking</span>
            </header>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={featureImportanceData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 14, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(99,179,237,0.08)" />
                  <XAxis
                    type="number"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={120}
                    tick={{ fill: '#F0F6FF', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(99,179,237,0.18)',
                      background: '#111C30',
                    }}
                    formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Importance']}
                  />
                  <Bar dataKey="score" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass-card portfolio-card card-enter">
            <header>
              <h3>Feature Correlation Heatmap</h3>
              <span>Clustering input correlation</span>
            </header>
            <div className="heatmap-grid">
              <div className="heatmap-header-empty" />
              {FEATURE_CONFIG.map((feature) => (
                <div key={`head-${feature.key}`} className="heatmap-header">
                  {feature.label}
                </div>
              ))}
              {FEATURE_CONFIG.map((rowFeature) => (
                <React.Fragment key={`row-${rowFeature.key}`}>
                  <div className="heatmap-row-label">{rowFeature.label}</div>
                  {FEATURE_CONFIG.map((colFeature) => {
                    const cell = correlationHeatmap.find(
                      (item) => item.row === rowFeature.label && item.col === colFeature.label
                    );
                    const value = cell?.value ?? 0;
                    const intensity = Math.min(1, Math.abs(value));
                    const positiveColor = `rgba(59,130,246,${0.12 + intensity * 0.5})`;
                    const negativeColor = `rgba(239,68,68,${0.12 + intensity * 0.5})`;
                    return (
                      <div
                        key={`${rowFeature.key}-${colFeature.key}`}
                        className="heatmap-cell"
                        style={{
                          background: value >= 0 ? positiveColor : negativeColor,
                          borderColor:
                            value >= 0
                              ? 'rgba(59,130,246,0.22)'
                              : 'rgba(239,68,68,0.22)',
                        }}
                        title={`${rowFeature.label} vs ${colFeature.label}: ${value.toFixed(3)}`}
                      >
                        {value.toFixed(2)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <p className="heatmap-note">
              Blue indicates positive correlation, red indicates inverse correlation.
            </p>
          </section>

          <section className="glass-card portfolio-card card-enter">
            <header>
              <h3>Discount Plot</h3>
              <span>Top 15 discount gaps</span>
            </header>
            <div className="portfolio-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={discountPlotData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(99,179,237,0.08)" />
                  <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    width={78}
                    tick={{ fill: '#F0F6FF', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(99,179,237,0.18)',
                      background: '#111C30',
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="price" fill="#3B82F6" name="Price" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="discountPrice" fill="#10B981" name="Discount Price" radius={[0, 4, 4, 0]} />
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
