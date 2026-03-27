import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AppShell from '../../components/layout/AppShell';
import QualityStockCard from '../../components/qualityStocks/QualityStockCard';
import { useAuth } from '../../context/AuthContext';
import { qualityStocksApi } from '../../services/qualityStocksApi';
import StockDetailDrawer from './StockDetailDrawer';

const buildIndicators = (payload) => {
  const sectorCount = payload?.sectors?.length || 0;
  return [
    { label: 'Sectors', value: String(sectorCount), tone: 'neutral' },
    { label: 'Stocks', value: String(payload?.total_stocks || 0), tone: 'positive' },
    {
      label: 'Updated',
      value: payload?.last_updated
        ? new Date(payload.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '--',
      tone: 'neutral',
    },
  ];
};

const QualityStocksPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [activeSector, setActiveSector] = useState(0);
  const [selectedStock, setSelectedStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    setError(null);
    qualityStocksApi
      .getAll()
      .then((res) => {
        setData(res.data);
        setActiveSector(0);
      })
      .catch((err) => {
        setError(err?.response?.data?.error || err.message || 'Failed to load quality stocks.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await qualityStocksApi.refresh();
      fetchAll();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const sectors = data?.sectors || [];
  const currentSectorData = sectors[activeSector];

  const indicators = useMemo(() => buildIndicators(data), [data]);

  return (
    <AppShell
      title="Quality Stocks"
      subtitle="Top-ranked stocks by sector, AI-analyzed"
      activePath="/quality-stocks"
      user={user}
      onLogout={handleLogout}
      indicators={indicators}
      portfolioValue="--"
      headerExtra={
        user?.is_staff ? (
          <Button
            variant="contained"
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              backgroundColor: '#6E57F7',
              '&:hover': { backgroundColor: '#5946d3' },
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        ) : null
      }
    >
      <Box className="glass-card" sx={{ p: 2, backgroundColor: '#0d1117', borderColor: '#1a1f35' }}>
        {loading ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {[1, 2, 3, 4].map((idx) => (
              <Skeleton
                key={idx}
                variant="rounded"
                height={280}
                sx={{ backgroundColor: 'rgba(154, 164, 191, 0.16)' }}
              />
            ))}
          </Box>
        ) : error ? (
          <Stack spacing={1.5}>
            <Alert severity="error">{error}</Alert>
            <Button
              variant="outlined"
              onClick={fetchAll}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                borderColor: '#6E57F7',
                color: '#b5a8ff',
              }}
            >
              Retry
            </Button>
          </Stack>
        ) : !sectors.length ? (
          <Alert severity="info">No quality stocks available yet.</Alert>
        ) : (
          <Stack spacing={2}>
            <Tabs
              value={activeSector}
              onChange={(_, next) => setActiveSector(next)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': { textTransform: 'none', color: '#9aa4bf' },
                '& .Mui-selected': { color: '#e8edff' },
                '& .MuiTabs-indicator': { backgroundColor: '#6E57F7' },
              }}
            >
              {sectors.map((item) => (
                <Tab key={item.sector} label={item.sector} />
              ))}
            </Tabs>

            <Typography sx={{ color: '#9aa4bf' }}>
              Showing {currentSectorData?.stocks?.length || 0} stocks in {currentSectorData?.sector || 'N/A'}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              {(currentSectorData?.stocks || []).map((stock) => (
                <QualityStockCard
                  key={stock.ticker}
                  stock={stock}
                  onCardClick={setSelectedStock}
                />
              ))}
            </Box>
          </Stack>
        )}
      </Box>

      <StockDetailDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </AppShell>
  );
};

export default QualityStocksPage;
