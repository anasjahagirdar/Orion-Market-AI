import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

const resolveColor = (score) => {
  if (score >= 70) {
    return '#00C851';
  }
  if (score >= 40) {
    return '#FFB300';
  }
  return '#FF4444';
};

const StockScoreBar = ({ score = 0 }) => {
  const numericScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const barColor = resolveColor(numericScore);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
        <Typography variant="caption" sx={{ color: '#9aa4bf' }}>
          Quality Score
        </Typography>
        <Typography variant="caption" sx={{ color: '#dbe3ff', fontWeight: 600 }}>
          {numericScore.toFixed(1)} / 100
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.max(0, Math.min(100, numericScore))}
        sx={{
          height: 8,
          borderRadius: 999,
          backgroundColor: 'rgba(154, 164, 191, 0.2)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: barColor,
            borderRadius: 999,
          },
        }}
      />
    </Box>
  );
};

export default React.memo(StockScoreBar);
