import React, { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
} from 'lightweight-charts';
import ChartContainer from './ChartContainer';

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
        background: { type: 'solid', color: '#060B18' },
        textColor: '#64748B',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(99,179,237,0.05)', style: 1 },
        horzLines: { color: 'rgba(99,179,237,0.05)', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(59,130,246,0.5)',
          labelBackgroundColor: '#111C30',
          style: 1,
          width: 1,
        },
        horzLine: {
          color: 'rgba(59,130,246,0.5)',
          labelBackgroundColor: '#111C30',
          style: 1,
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(99,179,237,0.1)',
        textColor: '#64748B',
      },
      timeScale: {
        borderColor: 'rgba(99,179,237,0.1)',
        textColor: '#64748B',
        timeVisible: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    const sma20Series = chart.addSeries(LineSeries, {
      color: '#3B82F6',
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
      color: d.close >= d.open ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
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
    <ChartContainer title={`${symbol} - Candlestick Chart`} className="candlestick-chart-container">
      <div className="candlestick-legend">
        <span className="sma-20">SMA 20</span>
        <span className="sma-50">SMA 50</span>
        <span className="bullish">Bullish</span>
        <span className="bearish">Bearish</span>
      </div>
      <div ref={chartContainerRef} />
    </ChartContainer>
  );
};

export default React.memo(CandlestickChart);
