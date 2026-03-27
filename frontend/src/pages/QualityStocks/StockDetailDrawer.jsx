import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AIReportPanel from '../../components/qualityStocks/AIReportPanel';
import FinancialBarChart from '../../components/qualityStocks/FinancialBarChart';
import FinancialRadarChart from '../../components/qualityStocks/FinancialRadarChart';
import PriceHistoryChart from '../../components/qualityStocks/PriceHistoryChart';
import SentimentChip from '../../components/qualityStocks/SentimentChip';
import { qualityStocksApi } from '../../services/qualityStocksApi';

const recommendationColor = {
  'Strong Buy': '#00C851',
  Buy: '#00897B',
  Hold: '#FFB300',
  Sell: '#FF4444',
};

const StockDetailDrawer = ({ stock, onClose }) => {
  const [tab, setTab] = useState(0);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTab(0);
  }, [stock?.ticker]);

  useEffect(() => {
    if (!stock?.ticker) {
      setDetail(null);
      setError('');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    qualityStocksApi
      .getDetail(stock.ticker)
      .then((res) => {
        if (!active) {
          return;
        }
        setDetail(res.data || null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setDetail(null);
        setError(err?.response?.data?.error || err.message || 'Failed to load stock details.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [stock?.ticker]);

  const data = useMemo(() => detail || stock || null, [detail, stock]);

  const recommendationTone = recommendationColor[data?.ai_report?.recommendation] || recommendationColor.Hold;

  const renderOverview = () => (
    <Stack spacing={2.2}>
      <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          label={data?.ai_report?.recommendation || 'Hold'}
          sx={{ backgroundColor: `${recommendationTone}22`, color: recommendationTone, fontWeight: 700 }}
        />
        <SentimentChip sentiment={data?.ai_report?.sentiment_label} />
        <Chip
          label={`Sentiment Score: ${Number(data?.ai_report?.sentiment_score || 0).toFixed(2)}`}
          variant="outlined"
          sx={{ borderColor: '#1a1f35', color: '#9aa4bf' }}
        />
      </Stack>

      <Box>
        <Typography sx={{ color: '#9aa4bf', mb: 1 }}>Strengths</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {(data?.ai_report?.strengths || []).map((item, idx) => (
            <Chip
              key={`strength-${idx}`}
              label={item}
              size="small"
              sx={{ backgroundColor: 'rgba(0, 200, 81, 0.12)', color: '#9be4b5' }}
            />
          ))}
          {(!data?.ai_report?.strengths || data.ai_report.strengths.length === 0) && (
            <Typography sx={{ color: '#7f89a8' }}>No strengths listed yet.</Typography>
          )}
        </Stack>
      </Box>

      <Box>
        <Typography sx={{ color: '#9aa4bf', mb: 1 }}>Risks</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {(data?.ai_report?.risks || []).map((item, idx) => (
            <Chip
              key={`risk-${idx}`}
              label={item}
              size="small"
              sx={{ backgroundColor: 'rgba(255, 68, 68, 0.12)', color: '#f6a6a6' }}
            />
          ))}
          {(!data?.ai_report?.risks || data.ai_report.risks.length === 0) && (
            <Typography sx={{ color: '#7f89a8' }}>No risks listed yet.</Typography>
          )}
        </Stack>
      </Box>

      <Typography sx={{ color: '#d3daf0' }}>{data?.ai_report?.summary || 'No summary available.'}</Typography>
    </Stack>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    if (!data) {
      return <Alert severity="info">No stock selected.</Alert>;
    }

    if (tab === 0) {
      return renderOverview();
    }
    if (tab === 1) {
      return <PriceHistoryChart history={data?.financials?.price_history_json || []} />;
    }
    if (tab === 2) {
      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Box sx={{ minHeight: 320 }}>
            <FinancialRadarChart stock={data} />
          </Box>
          <Box sx={{ minHeight: 320 }}>
            <FinancialBarChart stock={data} />
          </Box>
        </Box>
      );
    }
    return <AIReportPanel report={data?.ai_report} />;
  };

  return (
    <Drawer
      anchor="right"
      open={Boolean(stock)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 'min(720px, 100vw)',
          backgroundColor: '#0d1117',
          color: '#e8edff',
          borderLeft: '1px solid #1a1f35',
        },
      }}
    >
      <Box sx={{ p: 2.5, height: '100%', overflowY: 'auto' }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" mb={1.2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {stock?.ticker || 'Stock Detail'}
            </Typography>
            <Typography sx={{ color: '#9aa4bf' }}>
              {stock?.name || ''} {stock?.sector ? `- ${stock.sector}` : ''}
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#9aa4bf' }}>
            X
          </IconButton>
        </Stack>

        <Divider sx={{ borderColor: '#1a1f35', mb: 1.5 }} />

        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 2,
            '& .MuiTab-root': { color: '#9aa4bf', textTransform: 'none' },
            '& .Mui-selected': { color: '#e8edff' },
            '& .MuiTabs-indicator': { backgroundColor: '#6E57F7' },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Price History" />
          <Tab label="Financials" />
          <Tab label="AI Report" />
        </Tabs>

        {renderContent()}
      </Box>
    </Drawer>
  );
};

export default React.memo(StockDetailDrawer);
