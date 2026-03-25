import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
} from 'lightweight-charts';

const calcSMA = (data, period) =>
  data
    .map((d, i) => {
      if (i < period - 1) {
        return null;
      }
      const avg =
        data.slice(i - period + 1, i + 1).reduce((sum, x) => sum + x.close, 0) / period;
      return { time: d.date, value: avg };
    })
    .filter(Boolean);

const CandlestickChart = ({ data = [], symbol = '' }) => {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) {
      return undefined;
    }
    if (!chartContainerRef.current) {
      return undefined;
    }

    const normalized = data
      .map((d) => ({
        date: d.date,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: Number(d.volume),
      }))
      .filter(
        (d) =>
          d.date &&
          Number.isFinite(d.open) &&
          Number.isFinite(d.high) &&
          Number.isFinite(d.low) &&
          Number.isFinite(d.close) &&
          Number.isFinite(d.volume)
      );

    if (normalized.length === 0) {
      return undefined;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0B0E14' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.05)' },
        horzLines: { color: 'rgba(148,163,184,0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255,255,255,0.3)',
          style: 1,
          width: 1,
        },
        horzLine: {
          color: 'rgba(255,255,255,0.3)',
          style: 1,
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.1)',
        timeVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00D4FF',
      downColor: '#EF4444',
      borderUpColor: '#00D4FF',
      borderDownColor: '#EF4444',
      wickUpColor: '#00D4FF',
      wickDownColor: '#F87171',
    });

    const sma20Series = chart.addSeries(LineSeries, {
      color: '#00D4FF',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const candleData = normalized.map((d) => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = normalized.map((d) => ({
      time: d.date,
      value: d.volume,
      color: d.close >= d.open ? '#00D4FF' : '#EF4444',
    }));

    candleSeries.setData(candleData);
    sma20Series.setData(calcSMA(normalized, 20));
    sma50Series.setData(calcSMA(normalized, 50));
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (!chartContainerRef.current) {
        return;
      }
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data]);

  if (!data || data.length === 0) {
    return <p className="dashboard-empty">No OHLC data available for this range.</p>;
  }

  return (
    <div
      style={{
        background: '#0B0E14',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.07)',
        marginTop: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '15px',
            fontWeight: '600',
            margin: 0,
          }}
        >
          {symbol} — Candlestick Chart
        </h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
          <span style={{ color: '#00D4FF' }}>● SMA 20</span>
          <span style={{ color: '#F59E0B' }}>● SMA 50</span>
          <span style={{ color: '#00D4FF' }}>▲ Bullish</span>
          <span style={{ color: '#EF4444' }}>▼ Bearish</span>
        </div>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
};

export default CandlestickChart;
