import React, { useMemo } from 'react';
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
    <div style={{ width: '100%', height: 390 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id="priceLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="priceAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(0,212,255,0.2)" />
              <stop offset="100%" stopColor="rgba(0,212,255,0)" />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#94A3B8" strokeOpacity={0.05} />

          <XAxis
            dataKey="date"
            tickFormatter={formatTickDate}
            tick={{ fontSize: 12, fill: '#94A3B8' }}
            axisLine={{ stroke: 'rgba(148,163,184,0.12)' }}
            tickLine={false}
            minTickGap={24}
          />

          <YAxis
            yAxisId="price"
            tick={{ fontSize: 12, fill: '#94A3B8' }}
            axisLine={{ stroke: 'rgba(148,163,184,0.12)' }}
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
              background: '#1E293B',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#FFFFFF',
            }}
            labelStyle={{ color: '#FFFFFF' }}
            itemStyle={{ color: '#FFFFFF' }}
          />

          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="url(#priceLineGradient)"
            strokeWidth={2.5}
            fill="url(#priceAreaGradient)"
            dot={false}
            activeDot={false}
            isAnimationActive
          />

          <Area
            yAxisId="price"
            type="monotone"
            dataKey="ma20"
            stroke="#1D9E75"
            strokeWidth={1}
            fill="transparent"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          <Area
            yAxisId="price"
            type="monotone"
            dataKey="ma50"
            stroke="#D97706"
            strokeWidth={1}
            fill="transparent"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="rgba(29, 158, 117, 0.4)"
            barSize={3}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AreaChart;
