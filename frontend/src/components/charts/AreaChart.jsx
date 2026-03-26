import React, { useMemo } from 'react';
import '../../styles/components/area-chart.css';
import {
  Area,
  Bar,
  ComposedChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const calcMA = (data, period) =>
  data.map((_, i) => {
    if (i < period - 1) {
      return null;
    }
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((sum, d) => sum + d.close, 0) / period;
  });

const formatTickDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const AreaChart = ({ data = [] }) => {
  const chartData = useMemo(() => {
    const normalized = (data || [])
      .map((row) => ({
        date: row.date,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }))
      .filter(
        (row) =>
          row.date &&
          Number.isFinite(row.close) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.volume)
      );

    const ma20 = calcMA(normalized, 20);
    const ma50 = calcMA(normalized, 50);

    return normalized.map((row, index) => ({
      ...row,
      ma20: ma20[index],
      ma50: ma50[index],
    }));
  }, [data]);

  const maxVolume = useMemo(() => {
    if (!chartData.length) {
      return 0;
    }
    return Math.max(...chartData.map((row) => row.volume));
  }, [chartData]);

  if (!chartData.length) {
    return <p className="dashboard-empty">No chart data available for this timeframe.</p>;
  }

  return (
    <div className="area-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(99,179,237,0.06)" strokeOpacity={1} />

          <XAxis
            dataKey="date"
            tickFormatter={formatTickDate}
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={{ stroke: 'rgba(99,179,237,0.15)' }}
            tickLine={false}
            minTickGap={24}
          />

          <YAxis
            yAxisId="price"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={{ stroke: 'rgba(99,179,237,0.15)' }}
            tickLine={false}
            width={72}
            domain={['auto', 'auto']}
          />

          <YAxis
            yAxisId="volume"
            orientation="right"
            tick={false}
            axisLine={false}
            tickLine={false}
            domain={[0, maxVolume ? maxVolume * 3.3 : 'auto']}
            width={4}
          />

          <Tooltip
            contentStyle={{
              background: '#111C30',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '8px',
              color: '#F0F6FF',
            }}
            labelStyle={{ color: '#F0F6FF', fontSize: 13 }}
            itemStyle={{ color: '#F0F6FF', fontSize: 13 }}
          />

          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="url(#lineGradient)"
            strokeWidth={2.5}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={false}
            isAnimationActive
          />

          <Area
            yAxisId="price"
            type="monotone"
            dataKey="ma20"
            stroke="#10B981"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="transparent"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          <Area
            yAxisId="price"
            type="monotone"
            dataKey="ma50"
            stroke="#F59E0B"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="transparent"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="url(#volumeGradient)"
            barSize={3}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(AreaChart);
