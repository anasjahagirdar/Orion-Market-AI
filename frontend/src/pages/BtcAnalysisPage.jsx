import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import CandlestickChart from '../components/charts/CandlestickChart';
import MetricBox from '../components/ui/MetricBox';
import { useAuth } from '../context/AuthContext';
import { btcAPI } from '../services/api';
import '../styles/pages/btc-analysis-page.css';

const RANGE_OPTIONS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
];

const compactNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const toShortDate = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const BtcAnalysisPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState('1m');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  const fetchBtcAnalysis = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await btcAPI.getAnalysis(refresh);
      setPayload(response.data);
      setError('');
    } catch (requestError) {
      const message =
        requestError.response?.data?.error ||
        'Failed to fetch BTC analysis data from backend.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBtcAnalysis(false);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const selectedRange = useMemo(() => payload?.ranges?.[rangeKey] || [], [payload, rangeKey]);
  const latestPoint = selectedRange[selectedRange.length - 1] || null;
  const prevPoint = selectedRange[selectedRange.length - 2] || null;
  const latestClose = latestPoint?.close ?? null;
  const dailyChange = latestPoint && prevPoint ? latestPoint.close - prevPoint.close : null;
  const dailyChangePct =
    latestPoint && prevPoint && prevPoint.close
      ? (dailyChange / prevPoint.close) * 100
      : null;
  const trendPositive = dailyChange === null ? true : dailyChange >= 0;

  const priceSeries = useMemo(() => {
    return selectedRange.map((row) => ({
      date: row.date,
      close: Number(row.close),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      volume: Number(row.volume),
    }));
  }, [selectedRange]);

  const predictionSeries = useMemo(() => {
    const actualVsPredicted = payload?.ml?.predictions?.actual_vs_predicted || [];
    return actualVsPredicted.map((row) => ({
      date: row.date,
      actual_close: Number(row.actual_close),
      predicted_close: Number(row.predicted_close),
    }));
  }, [payload]);

  const futureSeries = payload?.ml?.predictions?.future || [];
  const metrics = payload?.ml?.metrics || {};
  const lime = payload?.ml?.explainability?.lime || {};
  const shap = payload?.ml?.explainability?.shap || {};
  const shapTop = (shap.global_importance || []).slice(0, 8);
  const limeTop = (lime.feature_importance || []).slice(0, 8);
  const limeChartData = useMemo(
    () =>
      limeTop
        .map((item) => ({
          feature: item.feature,
          weight: Number(item.weight),
          absWeight: Math.abs(Number(item.weight)),
        }))
        .filter((item) => Number.isFinite(item.weight))
        .sort((a, b) => b.absWeight - a.absWeight),
    [limeTop]
  );
  const shapChartData = useMemo(
    () =>
      shapTop
        .map((item) => ({
          feature: item.feature,
          score: Number(item.mean_abs_shap),
        }))
        .filter((item) => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score),
    [shapTop]
  );

  const headerIndicators = [
    {
      label: 'BTC/USD',
      value:
        dailyChangePct === null
          ? '--'
          : `${dailyChangePct >= 0 ? '+' : ''}${dailyChangePct.toFixed(2)}%`,
      tone: dailyChangePct === null ? 'neutral' : dailyChangePct >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Window',
      value: RANGE_OPTIONS.find((range) => range.key === rangeKey)?.label || '1M',
      tone: 'neutral',
    },
    {
      label: 'R2',
      value: metrics.r2_score !== undefined ? Number(metrics.r2_score).toFixed(4) : '--',
      tone: 'neutral',
    },
  ];

  return (
    <AppShell
      title="BTC/USD Analysis"
      subtitle="Historical price, ML forecast, and explainability"
      activePath="/btc-analysis"
      user={user}
      onLogout={handleLogout}
      indicators={headerIndicators}
      portfolioValue={latestClose ? `$${compactNumber(latestClose)}` : '--'}
    >
      <div className="kpi-grid">
        <MetricBox
          label="Current Close"
          value={latestClose ? `$${compactNumber(latestClose)}` : '--'}
          subtitle={latestPoint?.date ? `As of ${toShortDate(latestPoint.date)}` : 'No data'}
        />
        <MetricBox
          label="Daily Change"
          value={
            dailyChange === null
              ? '--'
              : `${dailyChange >= 0 ? '+' : ''}$${compactNumber(Math.abs(dailyChange))}`
          }
          subtitle={
            dailyChangePct === null
              ? 'No movement data'
              : `${dailyChangePct >= 0 ? '+' : ''}${dailyChangePct.toFixed(2)}%`
          }
          tone={trendPositive ? 'positive' : 'negative'}
        />
        <MetricBox
          label="R² Score"
          value={metrics.r2_score !== undefined ? Number(metrics.r2_score).toFixed(4) : '--'}
          subtitle="Model fit quality"
          tone="neutral"
        />
        <MetricBox
          label="RMSE"
          value={metrics.rmse !== undefined ? `$${compactNumber(metrics.rmse)}` : '--'}
          subtitle="Prediction error"
          tone={metrics.rmse !== undefined && Number(metrics.rmse) < 1000 ? 'positive' : 'negative'}
        />
      </div>

      <section className="btc-grid">
        <article className="glass-card btc-card card-enter">
          <header className="btc-card-header">
            <h3>BTC/USD Price Trend + Candlestick</h3>
            <div className="btc-range-pills">
              {RANGE_OPTIONS.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  className={`btn-press ${range.key === rangeKey ? 'active' : ''}`}
                  onClick={() => setRangeKey(range.key)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? (
            <div className="btc-loading-stack">
              <div className="skeleton btc-skeleton-line" />
              <div className="skeleton btc-skeleton-candle" />
            </div>
          ) : error ? (
            <p className="btc-state error">{error}</p>
          ) : (
            <>
              <div className="btc-chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={priceSeries}>
                    <defs>
                      <linearGradient id="btcAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(0,212,255,0.3)" />
                        <stop offset="100%" stopColor="rgba(0,212,255,0)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,212,255,0.06)" />
                    <XAxis dataKey="date" tickFormatter={toShortDate} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      labelFormatter={toShortDate}
                      formatter={(value, name) => [`$${compactNumber(value)}`, name]}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid rgba(0,212,255,0.3)',
                        background: '#111C30',
                      }}
                      cursor={{ stroke: 'rgba(0,212,255,0.35)', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="close"
                      fill="url(#btcAreaFill)"
                      stroke="none"
                      dot={false}
                      activeDot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      name="Close"
                      stroke="#00D4FF"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="high"
                      name="High"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="low"
                      name="Low"
                      stroke="#22D3EE"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Brush
                      dataKey="date"
                      height={24}
                      stroke="#00D4FF"
                      travellerWidth={10}
                      tickFormatter={toShortDate}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="btc-candle-section">
                <CandlestickChart data={priceSeries} symbol="BTC/USD" />
              </div>
            </>
          )}
        </article>

        <article className="glass-card btc-card card-enter">
          <header className="btc-card-header">
            <h3>Predicted vs Actual</h3>
            <button
              type="button"
              className="btc-refresh-btn btn-press"
              onClick={() => fetchBtcAnalysis(true)}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </header>

          {loading ? (
            <div className="btc-loading-stack">
              <div className="skeleton btc-skeleton-line" />
              <div className="skeleton btc-skeleton-strip" />
            </div>
          ) : predictionSeries.length === 0 ? (
            <p className="btc-state">Prediction series unavailable.</p>
          ) : (
            <>
              <div className="btc-chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={predictionSeries}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(245,158,11,0.05)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={toShortDate}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      labelFormatter={toShortDate}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid rgba(245,158,11,0.3)',
                        background: '#111C30',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual_close"
                      name="Actual"
                      stroke="#F59E0B"
                      strokeWidth={2.4}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted_close"
                      name="Predicted"
                      stroke="#10B981"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="btc-future-strip">
                <h4>Next 7 Predicted Closes</h4>
                <div className="btc-future-list">
                  {futureSeries.map((row) => (
                    <div key={row.date} className="btc-future-item">
                      <span>{toShortDate(row.date)}</span>
                      <strong>${compactNumber(row.predicted_close)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="btc-grid">
        <article className="glass-card btc-card card-enter">
          <header className="btc-card-header">
            <h3>LIME Local Explanation</h3>
            <span className={`status-tag ${lime.status === 'ok' ? 'ok' : 'warn'}`}>
              {lime.status || 'unknown'}
            </span>
          </header>
          {lime.status === 'ok' ? (
            <>
              <p className="btc-explain-meta">
                Prediction Date: {toShortDate(lime.prediction_date)} | Predicted: $
                {compactNumber(lime.predicted_close)} | Actual: ${compactNumber(lime.actual_close)}
              </p>
              <div className="impact-chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={limeChartData}
                    layout="vertical"
                    margin={{ top: 8, right: 18, left: 16, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.08)" />
                    <XAxis
                      type="number"
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      tickFormatter={(value) => Number(value).toFixed(3)}
                    />
                    <YAxis
                      dataKey="feature"
                      type="category"
                      width={130}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid rgba(0,212,255,0.22)',
                        background: '#111C30',
                      }}
                      formatter={(value) => [Number(value).toFixed(6), 'Weight']}
                    />
                    <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                      {limeChartData.map((row, index) => (
                        <Cell
                          key={`${row.feature}-${index}`}
                          fill={row.weight >= 0 ? '#00D4FF' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="btc-state">{lime.reason || 'LIME output unavailable.'}</p>
          )}
        </article>

        <article className="glass-card btc-card card-enter">
          <header className="btc-card-header">
            <h3>SHAP Global Importance</h3>
            <span className={`status-tag ${shap.status === 'ok' ? 'ok' : 'warn'}`}>
              {shap.status || 'unknown'}
            </span>
          </header>
          {shap.status === 'ok' ? (
            <div className="impact-chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={shapChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 18, left: 16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.08)" />
                  <XAxis
                    type="number"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    tickFormatter={(value) => Number(value).toFixed(3)}
                  />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={130}
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(0,212,255,0.22)',
                      background: '#111C30',
                    }}
                    formatter={(value) => [Number(value).toFixed(6), 'Mean |SHAP|']}
                  />
                  <Bar dataKey="score" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="btc-state">{shap.reason || 'SHAP output unavailable.'}</p>
          )}
        </article>
      </section>
    </AppShell>
  );
};

export default BtcAnalysisPage;
