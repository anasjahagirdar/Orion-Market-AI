import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
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
import AppShell from '../components/AppShell';
import MetricCard from '../components/MetricCard';
import { useAuth } from '../context/AuthContext';
import { btcAPI } from '../services/api';
import './btc-analysis-page.css';

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
      label: 'R²',
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
        <MetricCard
          label="Current Close"
          value={latestClose ? `$${compactNumber(latestClose)}` : '--'}
          subtitle={latestPoint?.date ? `As of ${toShortDate(latestPoint.date)}` : 'No data'}
        />
        <MetricCard
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
        <MetricCard
          label="R² Score"
          value={metrics.r2_score !== undefined ? Number(metrics.r2_score).toFixed(4) : '--'}
          subtitle="Model fit quality"
          tone="neutral"
        />
        <MetricCard
          label="RMSE"
          value={metrics.rmse !== undefined ? `$${compactNumber(metrics.rmse)}` : '--'}
          subtitle="Prediction error"
          tone={metrics.rmse !== undefined && Number(metrics.rmse) < 1000 ? 'positive' : 'negative'}
        />
      </div>

      <section className="btc-grid">
        <article className="glass-card btc-card">
          <header className="btc-card-header">
            <h3>BTC/USD Price Trend</h3>
            <div className="btc-range-pills">
              {RANGE_OPTIONS.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  className={range.key === rangeKey ? 'active' : ''}
                  onClick={() => setRangeKey(range.key)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? (
            <p className="btc-state">Loading BTC data...</p>
          ) : error ? (
            <p className="btc-state error">{error}</p>
          ) : (
            <div className="btc-chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceSeries}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(136, 168, 209, 0.18)" />
                  <XAxis dataKey="date" tickFormatter={toShortDate} tick={{ fill: '#9fb3d2', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9fb3d2', fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={toShortDate}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid rgba(90, 139, 255, 0.35)',
                      background: 'rgba(11, 19, 34, 0.95)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    name="Close"
                    stroke={trendPositive ? '#2ece86' : '#ff6b6b'}
                    strokeWidth={2.6}
                    dot={false}
                  />
                  <Line type="monotone" dataKey="high" name="High" stroke="#5a8bff" strokeWidth={1.6} dot={false} />
                  <Line type="monotone" dataKey="low" name="Low" stroke="#f5c542" strokeWidth={1.6} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="glass-card btc-card">
          <header className="btc-card-header">
            <h3>Predicted vs Actual</h3>
            <button
              type="button"
              className="btc-refresh-btn"
              onClick={() => fetchBtcAnalysis(true)}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </header>

          {loading ? (
            <p className="btc-state">Loading prediction chart...</p>
          ) : predictionSeries.length === 0 ? (
            <p className="btc-state">Prediction series unavailable.</p>
          ) : (
            <>
              <div className="btc-chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={predictionSeries}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(136, 168, 209, 0.18)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={toShortDate}
                      tick={{ fill: '#9fb3d2', fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: '#9fb3d2', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      labelFormatter={toShortDate}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid rgba(245, 197, 66, 0.35)',
                        background: 'rgba(11, 19, 34, 0.95)',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual_close"
                      name="Actual"
                      stroke="#2ece86"
                      strokeWidth={2.4}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted_close"
                      name="Predicted"
                      stroke="#5a8bff"
                      strokeWidth={2.1}
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
        <article className="glass-card btc-card">
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
              <ul className="impact-list">
                {limeTop.map((item, index) => (
                  <li key={`${item.feature}-${index}`}>
                    <span>{item.feature}</span>
                    <strong className={item.weight >= 0 ? 'up' : 'down'}>
                      {item.weight >= 0 ? '+' : ''}
                      {Number(item.weight).toFixed(6)}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="btc-state">{lime.reason || 'LIME output unavailable.'}</p>
          )}
        </article>

        <article className="glass-card btc-card">
          <header className="btc-card-header">
            <h3>SHAP Global Importance</h3>
            <span className={`status-tag ${shap.status === 'ok' ? 'ok' : 'warn'}`}>
              {shap.status || 'unknown'}
            </span>
          </header>
          {shap.status === 'ok' ? (
            <ul className="impact-list">
              {shapTop.map((item, index) => (
                <li key={`${item.feature}-${index}`}>
                  <span>{item.feature}</span>
                  <strong>{Number(item.mean_abs_shap).toFixed(6)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="btc-state">{shap.reason || 'SHAP output unavailable.'}</p>
          )}
        </article>
      </section>
    </AppShell>
  );
};

export default BtcAnalysisPage;
