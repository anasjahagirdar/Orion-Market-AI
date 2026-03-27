import React, { useMemo } from 'react';
import { Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const SECTOR_AVERAGES = {
  Technology: { pe: 26, beta: 1.15 },
  Finance: { pe: 15, beta: 1.05 },
  Healthcare: { pe: 21, beta: 0.9 },
  Energy: { pe: 14, beta: 1.2 },
  'Consumer Goods': { pe: 24, beta: 0.8 },
  Industrials: { pe: 22, beta: 1.1 },
  Telecommunications: { pe: 18, beta: 0.85 },
  'Real Estate': { pe: 20, beta: 1.0 },
  Materials: { pe: 17, beta: 1.1 },
  Utilities: { pe: 19, beta: 0.7 },
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const FinancialBarChart = ({ stock }) => {
  const barData = useMemo(() => {
    const financials = stock?.financials || {};
    return [
      { name: 'PE Ratio', value: toNumber(financials.pe_ratio) },
      { name: 'PB Ratio', value: toNumber(financials.pb_ratio) },
      { name: 'Debt/Equity', value: toNumber(financials.debt_to_equity) },
      { name: 'Beta', value: toNumber(financials.beta) },
    ];
  }, [stock]);

  const avg = SECTOR_AVERAGES[stock?.sector] || { pe: 20, beta: 1.0 };

  if (!stock) {
    return <Typography sx={{ color: '#9aa4bf' }}>No valuation data available.</Typography>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={barData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" />
        <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} />
        <YAxis tick={{ fill: '#aaa', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #6E57F7' }} />
        <Bar dataKey="value" fill="#6E57F7" radius={[4, 4, 0, 0]} />
        <ReferenceLine
          y={avg.pe}
          stroke="#FF6B6B"
          strokeDasharray="4 4"
          label={{ value: 'Avg PE', fill: '#FF6B6B', fontSize: 10 }}
        />
        <ReferenceLine
          y={avg.beta}
          stroke="#4DD0E1"
          strokeDasharray="4 4"
          label={{ value: 'Avg Beta', fill: '#4DD0E1', fontSize: 10 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default React.memo(FinancialBarChart);
