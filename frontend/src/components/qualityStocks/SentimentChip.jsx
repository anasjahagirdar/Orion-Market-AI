import React from 'react';
import Chip from '@mui/material/Chip';

const toneMap = {
  Bullish: { label: 'Bullish', color: '#00C851', bg: 'rgba(0, 200, 81, 0.15)' },
  Neutral: { label: 'Neutral', color: '#FFB300', bg: 'rgba(255, 179, 0, 0.16)' },
  Bearish: { label: 'Bearish', color: '#FF4444', bg: 'rgba(255, 68, 68, 0.16)' },
};

const SentimentChip = ({ sentiment }) => {
  const tone = toneMap[sentiment] || toneMap.Neutral;

  return (
    <Chip
      label={tone.label}
      size="small"
      sx={{
        color: tone.color,
        borderColor: tone.color,
        backgroundColor: tone.bg,
        fontWeight: 600,
      }}
      variant="outlined"
    />
  );
};

export default React.memo(SentimentChip);
