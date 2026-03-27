import React, { useMemo } from 'react';
import { Typography } from '@mui/material';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const capAt = (value, maxValue) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || maxValue <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (numeric / maxValue) * 100));
};

const FinancialRadarChart = ({ stock }) => {
  const radarData = useMemo(() => {
    const financials = stock?.financials || {};

    return [
      { metric: 'ROE', value: capAt(financials.roe, 35) },
      { metric: 'Profit Margin', value: capAt(financials.profit_margin, 30) },
      { metric: 'Revenue Growth', value: capAt(financials.revenue_growth_yoy, 35) },
      { metric: 'Quality Score', value: capAt(stock?.quality_score, 100) },
      { metric: 'Dividend Yield', value: capAt(financials.dividend_yield, 8) },
    ];
  }, [stock]);

  if (!stock) {
    return <Typography sx={{ color: '#9aa4bf' }}>No financial data available.</Typography>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
        <PolarGrid stroke="#1a1f35" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#aaa', fontSize: 11 }} />
        <Radar
          name={stock.ticker}
          dataKey="value"
          stroke="#6E57F7"
          fill="#6E57F7"
          fillOpacity={0.25}
        />
        <Tooltip
          contentStyle={{ background: '#0d1117', border: '1px solid #6E57F7' }}
          formatter={(value) => `${Number(value).toFixed(1)} / 100`}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default React.memo(FinancialRadarChart);
