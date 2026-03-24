import React, { useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import './candlestick-chart.css';

const PERIOD_OPTIONS = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
];

const CandlestickChart = ({ symbol, data = [], loading, period, onPeriodChange }) => {
  const series = useMemo(() => {
    const candles = data.map((point) => ({
      x: new Date(point.date),
      y: [point.open, point.high, point.low, point.close],
    }));
    return [{ data: candles }];
  }, [data]);

  const options = useMemo(
    () => ({
      chart: {
        type: 'candlestick',
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, speed: 360 },
      },
      theme: { mode: 'dark' },
      grid: {
        borderColor: 'rgba(136, 168, 209, 0.2)',
        strokeDashArray: 4,
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: '#2ece86',
            downward: '#ff5c7c',
          },
          wick: {
            useFillColor: true,
          },
        },
      },
      xaxis: {
        type: 'datetime',
        labels: {
          datetimeUTC: false,
          style: { colors: '#9fb3d2' },
        },
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          style: { colors: '#9fb3d2' },
          formatter: (value) => Number(value).toFixed(2),
        },
      },
      tooltip: {
        theme: 'dark',
      },
    }),
    []
  );

  return (
    <div className="candlestick-chart">
      <div className="candlestick-header">
        <div>
          <h3>{symbol} OHLC Candlestick</h3>
          <p className="dashboard-card-subtitle">Open, high, low, close view</p>
        </div>
        <div className="candlestick-filters">
          {PERIOD_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`candlestick-filter ${period === item.key ? 'active' : ''}`}
              onClick={() => onPeriodChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="candlestick-canvas">
        {loading ? (
          <p className="dashboard-empty">Loading candlestick chart...</p>
        ) : series[0].data.length === 0 ? (
          <p className="dashboard-empty">No OHLC data available for this range.</p>
        ) : (
          <ReactApexChart options={options} series={series} type="candlestick" height={280} />
        )}
      </div>
    </div>
  );
};

export default CandlestickChart;
