import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
  Button,
} from '@mui/material';
import SentimentChip from './SentimentChip';
import StockScoreBar from './StockScoreBar';

const rankTone = {
  1: { color: '#f5c451', bg: 'rgba(245, 196, 81, 0.18)' },
  2: { color: '#bcc6d8', bg: 'rgba(188, 198, 216, 0.18)' },
  3: { color: '#d78b58', bg: 'rgba(215, 139, 88, 0.18)' },
};

const recommendationColor = {
  'Strong Buy': '#00C851',
  Buy: '#00897B',
  Hold: '#FFB300',
  Sell: '#FF4444',
};

const formatCurrency = (value, market) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'N/A';
  }
  const prefix = market === 'IN' ? 'Rs ' : '$';
  return `${prefix}${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const formatMetric = (value, suffix = '') => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'N/A';
  }
  return `${numeric.toFixed(2)}${suffix}`;
};

const QualityStockCard = ({ stock, onCardClick }) => {
  const rank = Number(stock?.rank_in_sector) || 4;
  const rankStyle = rankTone[rank] || { color: '#9aa4bf', bg: 'rgba(154, 164, 191, 0.16)' };
  const recommendation = stock?.ai_report?.recommendation || 'Hold';
  const recommendationTone = recommendationColor[recommendation] || recommendationColor.Hold;

  return (
    <Card
      sx={{
        background: '#0d1117',
        border: '1px solid #1a1f35',
        borderRadius: 3,
        color: '#e8edff',
        height: '100%',
      }}
    >
      <CardContent>
        <Stack spacing={1.4}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Chip
              label={`#${rank}`}
              size="small"
              sx={{
                color: rankStyle.color,
                backgroundColor: rankStyle.bg,
                fontWeight: 700,
              }}
            />
            <Typography variant="caption" sx={{ color: '#9aa4bf' }}>
              [{stock?.exchange || 'N/A'}]
            </Typography>
          </Stack>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
              {stock?.ticker || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#9aa4bf' }}>
              {stock?.name || 'N/A'} - {stock?.sector || 'N/A'}
            </Typography>
          </Box>

          <StockScoreBar score={stock?.quality_score} />

          <Stack spacing={0.4}>
            <Typography variant="body2" sx={{ color: '#c4cde8' }}>
              {formatCurrency(stock?.financials?.current_price, stock?.market)} - PE {formatMetric(stock?.financials?.pe_ratio)} - ROE {formatMetric(stock?.financials?.roe, '%')}
            </Typography>
            <Typography variant="body2" sx={{ color: '#c4cde8' }}>
              Margin {formatMetric(stock?.financials?.profit_margin, '%')} - Growth {formatMetric(stock?.financials?.revenue_growth_yoy, '%')}
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <SentimentChip sentiment={stock?.ai_report?.sentiment_label} />
            <Typography variant="body2" sx={{ color: recommendationTone, fontWeight: 700 }}>
              {recommendation}
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            sx={{
              color: '#b6bfd9',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 42,
            }}
          >
            {stock?.ai_report?.summary || 'AI summary is not available yet for this stock.'}
          </Typography>

          <Button
            variant="text"
            sx={{
              alignSelf: 'flex-end',
              color: '#63b3ed',
              textTransform: 'none',
              fontWeight: 700,
            }}
            onClick={() => onCardClick(stock)}
          >
            View Full Analysis -&gt;
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default React.memo(QualityStockCard);
