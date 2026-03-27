import React, { useMemo, useState } from 'react';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const RANGE_TO_DAYS = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
};

const formatTickDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '');
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const PriceHistoryChart = ({ history = [] }) => {
  const [range, setRange] = useState('6M');

  const normalizedHistory = useMemo(
    () =>
      (history || [])
        .map((entry) => ({
          ...entry,
          close: Number(entry.close),
        }))
        .filter((entry) => entry.date && Number.isFinite(entry.close)),
    [history]
  );

  const filteredHistory = useMemo(() => {
    if (!normalizedHistory.length) {
      return [];
    }

    const days = RANGE_TO_DAYS[range] || 180;
    const lastDate = new Date(normalizedHistory[normalizedHistory.length - 1].date);
    if (Number.isNaN(lastDate.getTime())) {
      return normalizedHistory;
    }

    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - days);

    return normalizedHistory.filter((entry) => {
      const current = new Date(entry.date);
      return Number.isNaN(current.getTime()) ? true : current >= cutoff;
    });
  }, [normalizedHistory, range]);

  if (!filteredHistory.length) {
    return <Typography sx={{ color: '#9aa4bf' }}>No price history available.</Typography>;
  }

  return (
    <Box>
      <ButtonGroup size="small" sx={{ mb: 1.5 }}>
        {['1M', '3M', '6M'].map((option) => (
          <Button
            key={option}
            onClick={() => setRange(option)}
            variant={range === option ? 'contained' : 'outlined'}
            sx={{
              borderColor: '#1a1f35',
              color: range === option ? '#ffffff' : '#9aa4bf',
              backgroundColor: range === option ? '#6E57F7' : 'transparent',
              '&:hover': {
                borderColor: '#6E57F7',
                backgroundColor: range === option ? '#6E57F7' : 'rgba(110, 87, 247, 0.08)',
              },
            }}
          >
            {option}
          </Button>
        ))}
      </ButtonGroup>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={filteredHistory}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6E57F7" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#6E57F7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" />
          <XAxis
            dataKey="date"
            tickFormatter={formatTickDate}
            tick={{ fill: '#888', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip
            labelFormatter={(value) => formatTickDate(value)}
            contentStyle={{ background: '#0d1117', border: '1px solid #6E57F7' }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#6E57F7"
            strokeWidth={2}
            fill="url(#priceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default React.memo(PriceHistoryChart);
