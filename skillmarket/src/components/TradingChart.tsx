"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from "lightweight-charts";
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateVWAP,
  calculateStochastic,
  calculateATR,
  calculateCCI,
  calculateWilliamsR,
  calculateOBV,
  type OHLCVCandle,
} from "@/lib/indicators";

// ── Indicator registry ──

export type IndicatorCategory = "overlay" | "oscillator";

export interface IndicatorConfig {
  id: string;
  label: string;
  shortLabel: string;
  category: IndicatorCategory;
  color: string;
  secondaryColor?: string;
  defaultEnabled: boolean;
  refLines?: { value: number; color: string }[];
}

export const INDICATORS: IndicatorConfig[] = [
  // Overlays
  { id: "sma", label: "SMA (20)", shortLabel: "SMA", category: "overlay", color: "#e8b84a", defaultEnabled: false },
  { id: "ema", label: "EMA (12)", shortLabel: "EMA", category: "overlay", color: "#00bcd4", defaultEnabled: false },
  { id: "bb", label: "Bollinger Bands (20)", shortLabel: "BB", category: "overlay", color: "#9c27b0", defaultEnabled: false },
  { id: "vwap", label: "VWAP", shortLabel: "VWAP", category: "overlay", color: "#ff9800", defaultEnabled: false },
  // Oscillators
  { id: "rsi", label: "RSI (14)", shortLabel: "RSI", category: "oscillator", color: "#7c5cfc", defaultEnabled: false, refLines: [{ value: 70, color: "rgba(214,69,69,0.4)" }, { value: 30, color: "rgba(61,122,92,0.4)" }] },
  { id: "macd", label: "MACD (12,26,9)", shortLabel: "MACD", category: "oscillator", color: "#3d7a5c", secondaryColor: "#d64545", defaultEnabled: false },
  { id: "stoch", label: "Stochastic (14,3)", shortLabel: "Stoch", category: "oscillator", color: "#2196f3", secondaryColor: "#ff9800", defaultEnabled: false, refLines: [{ value: 80, color: "rgba(214,69,69,0.4)" }, { value: 20, color: "rgba(61,122,92,0.4)" }] },
  { id: "atr", label: "ATR (14)", shortLabel: "ATR", category: "oscillator", color: "#009688", defaultEnabled: false },
  { id: "cci", label: "CCI (20)", shortLabel: "CCI", category: "oscillator", color: "#ffc107", defaultEnabled: false, refLines: [{ value: 100, color: "rgba(214,69,69,0.4)" }, { value: -100, color: "rgba(61,122,92,0.4)" }] },
  { id: "willr", label: "Williams %R (14)", shortLabel: "Will%R", category: "oscillator", color: "#e91e63", defaultEnabled: false, refLines: [{ value: -20, color: "rgba(214,69,69,0.4)" }, { value: -80, color: "rgba(61,122,92,0.4)" }] },
  { id: "obv", label: "OBV", shortLabel: "OBV", category: "oscillator", color: "#78909c", defaultEnabled: false },
];

// ── Theme ──

const THEME = {
  bg: "#0a0f1a",
  grid: "#1a2030",
  text: "#9ca3af",
  crosshair: "#4a9b72",
  up: "#3d7a5c",
  down: "#d64545",
  border: "#1f2937",
};

// ── Props ──

interface TradingChartProps {
  candles: OHLCVCandle[];
  activeIndicators: Set<string>;
}

// ── Helpers ──

/**
 * Determine how many decimals to show for a given price level.
 * Tokens on nad.fun can have prices like 0.000003 — we need enough precision.
 */
function priceDecimals(candles: OHLCVCandle[]): number {
  if (candles.length === 0) return 2;
  // Use the median close price to determine precision
  const closes = candles.map((c) => c.close).filter((v) => v > 0).sort((a, b) => a - b);
  const median = closes[Math.floor(closes.length / 2)] || 0;
  if (median === 0) return 2;
  if (median < 0.000001) return 10;
  if (median < 0.0001) return 8;
  if (median < 0.01) return 6;
  if (median < 1) return 4;
  return 2;
}

function getChartOptions(width: number, height: number, hideTimeScale = false) {
  return {
    width,
    height,
    layout: { background: { type: ColorType.Solid as const, color: THEME.bg }, textColor: THEME.text, fontFamily: "'JetBrains Mono', monospace" },
    grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: THEME.crosshair, width: 1 as const, labelBackgroundColor: THEME.crosshair }, horzLine: { color: THEME.crosshair, width: 1 as const, labelBackgroundColor: THEME.crosshair } },
    rightPriceScale: { borderColor: THEME.border },
    timeScale: { borderColor: THEME.border, timeVisible: true, secondsVisible: false, visible: !hideTimeScale },
  };
}

function safeRemove(chart: IChartApi | null) {
  if (!chart) return;
  try { chart.remove(); } catch { /* already disposed */ }
}

// ── Component ──

export default function TradingChart({ candles, activeIndicators }: TradingChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const oscRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chartsRef = useRef<{ main: IChartApi | null; oscillators: Map<string, IChartApi> }>({
    main: null,
    oscillators: new Map(),
  });

  // Which oscillators are active
  const activeOscillators = useMemo(
    () => INDICATORS.filter((ind) => ind.category === "oscillator" && activeIndicators.has(ind.id)),
    [activeIndicators]
  );

  // Main chart + overlay effect
  useEffect(() => {
    if (!mainRef.current || candles.length === 0) return;

    // Clean up
    safeRemove(chartsRef.current.main);
    chartsRef.current.oscillators.forEach((c) => safeRemove(c));
    chartsRef.current = { main: null, oscillators: new Map() };

    if (mainRef.current) mainRef.current.innerHTML = "";
    oscRefs.current.forEach((el) => { el.innerHTML = ""; });

    const width = mainRef.current.clientWidth;
    if (width === 0) return;

    // === Main Chart ===
    const mainChart = createChart(mainRef.current, getChartOptions(width, 600));
    chartsRef.current.main = mainChart;

    // Candlestick data
    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const decimals = priceDecimals(candles);
    const minMove = parseFloat((1 / Math.pow(10, decimals)).toFixed(decimals));

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: THEME.up,
      downColor: THEME.down,
      borderUpColor: THEME.up,
      borderDownColor: THEME.down,
      wickUpColor: THEME.up,
      wickDownColor: THEME.down,
      priceFormat: { type: "price" as const, precision: decimals, minMove },
    });
    candleSeries.setData(candleData);

    // Volume overlay
    const maxVol = Math.max(...candles.map((c) => c.volume));
    const volDivisor = maxVol > 1e13 ? maxVol / 1e10 : 1;
    const volumeData: HistogramData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume / volDivisor,
      color: c.close >= c.open ? "rgba(61,122,92,0.3)" : "rgba(214,69,69,0.3)",
    }));
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeries.setData(volumeData);

    // === Overlay indicators ===
    if (activeIndicators.has("sma")) {
      const data = calculateSMA(candles, 20);
      if (data.length > 0) {
        const s = mainChart.addSeries(LineSeries, { color: "#e8b84a", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
      }
    }

    if (activeIndicators.has("ema")) {
      const data = calculateEMA(candles, 12);
      if (data.length > 0) {
        const s = mainChart.addSeries(LineSeries, { color: "#00bcd4", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
      }
    }

    if (activeIndicators.has("bb")) {
      const data = calculateBollingerBands(candles, 20, 2);
      if (data.length > 0) {
        const times = data.map((d) => d.time as Time);
        // Upper band (dashed)
        const upper = mainChart.addSeries(LineSeries, { color: "#9c27b0", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        upper.setData(data.map((d, i) => ({ time: times[i], value: d.upper })));
        // Middle band (solid)
        const middle = mainChart.addSeries(LineSeries, { color: "#9c27b0", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        middle.setData(data.map((d, i) => ({ time: times[i], value: d.middle })));
        // Lower band (dashed)
        const lower = mainChart.addSeries(LineSeries, { color: "#9c27b0", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
        lower.setData(data.map((d, i) => ({ time: times[i], value: d.lower })));
      }
    }

    if (activeIndicators.has("vwap")) {
      const data = calculateVWAP(candles);
      if (data.length > 0) {
        const s = mainChart.addSeries(LineSeries, { color: "#ff9800", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
      }
    }

    mainChart.timeScale().fitContent();

    // === Oscillator sub-panes ===
    const oscCharts = new Map<string, IChartApi>();

    for (const ind of activeOscillators) {
      const el = oscRefs.current.get(ind.id);
      if (!el) continue;
      el.innerHTML = "";

      const isLast = ind.id === activeOscillators[activeOscillators.length - 1]?.id;
      const oscChart = createChart(el, getChartOptions(width, 120, !isLast ? true : false));
      oscCharts.set(ind.id, oscChart);

      if (ind.id === "rsi") {
        const data = calculateRSI(candles);
        if (data.length > 0) {
          const rsiS = oscChart.addSeries(LineSeries, { color: ind.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          rsiS.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
          // Reference lines
          const times = data.map((d) => d.time as Time);
          const ob = oscChart.addSeries(LineSeries, { color: "rgba(214,69,69,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          ob.setData(times.map((t) => ({ time: t, value: 70 })));
          const os = oscChart.addSeries(LineSeries, { color: "rgba(61,122,92,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          os.setData(times.map((t) => ({ time: t, value: 30 })));
        }
      }

      if (ind.id === "macd") {
        const data = calculateMACD(candles);
        if (data.length > 0) {
          const hist = oscChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
          hist.setData(data.map((d) => ({ time: d.time as Time, value: d.histogram, color: d.histogram >= 0 ? "rgba(61,122,92,0.6)" : "rgba(214,69,69,0.6)" })));
          const macdL = oscChart.addSeries(LineSeries, { color: "#3d7a5c", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          macdL.setData(data.map((d) => ({ time: d.time as Time, value: d.macd })));
          const sigL = oscChart.addSeries(LineSeries, { color: "#d64545", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          sigL.setData(data.map((d) => ({ time: d.time as Time, value: d.signal })));
        }
      }

      if (ind.id === "stoch") {
        const data = calculateStochastic(candles);
        if (data.length > 0) {
          const kS = oscChart.addSeries(LineSeries, { color: "#2196f3", lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          kS.setData(data.map((d) => ({ time: d.time as Time, value: d.k })));
          const dS = oscChart.addSeries(LineSeries, { color: "#ff9800", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          dS.setData(data.map((d) => ({ time: d.time as Time, value: d.d })));
          const times = data.map((d) => d.time as Time);
          const ob = oscChart.addSeries(LineSeries, { color: "rgba(214,69,69,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          ob.setData(times.map((t) => ({ time: t, value: 80 })));
          const os = oscChart.addSeries(LineSeries, { color: "rgba(61,122,92,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          os.setData(times.map((t) => ({ time: t, value: 20 })));
        }
      }

      if (ind.id === "atr") {
        const data = calculateATR(candles);
        if (data.length > 0) {
          const s = oscChart.addSeries(LineSeries, { color: ind.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
        }
      }

      if (ind.id === "cci") {
        const data = calculateCCI(candles);
        if (data.length > 0) {
          const s = oscChart.addSeries(LineSeries, { color: ind.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
          const times = data.map((d) => d.time as Time);
          const ob = oscChart.addSeries(LineSeries, { color: "rgba(214,69,69,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          ob.setData(times.map((t) => ({ time: t, value: 100 })));
          const os = oscChart.addSeries(LineSeries, { color: "rgba(61,122,92,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          os.setData(times.map((t) => ({ time: t, value: -100 })));
        }
      }

      if (ind.id === "willr") {
        const data = calculateWilliamsR(candles);
        if (data.length > 0) {
          const s = oscChart.addSeries(LineSeries, { color: ind.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          s.setData(data.map((d) => ({ time: d.time as Time, value: d.value })));
          const times = data.map((d) => d.time as Time);
          const ob = oscChart.addSeries(LineSeries, { color: "rgba(214,69,69,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          ob.setData(times.map((t) => ({ time: t, value: -20 })));
          const os = oscChart.addSeries(LineSeries, { color: "rgba(61,122,92,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          os.setData(times.map((t) => ({ time: t, value: -80 })));
        }
      }

      if (ind.id === "obv") {
        const data = calculateOBV(candles);
        // Normalize OBV for lightweight-charts limits
        const maxOBV = Math.max(...data.map((d) => Math.abs(d.value)));
        const obvDivisor = maxOBV > 1e13 ? maxOBV / 1e10 : 1;
        if (data.length > 0) {
          const s = oscChart.addSeries(LineSeries, { color: ind.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          s.setData(data.map((d) => ({ time: d.time as Time, value: d.value / obvDivisor })));
        }
      }

      oscChart.timeScale().fitContent();

      // Sync with main chart
      try {
        mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (range) { try { oscChart.timeScale().setVisibleLogicalRange(range); } catch {} }
        });
        oscChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (range) { try { mainChart.timeScale().setVisibleLogicalRange(range); } catch {} }
        });
      } catch {}
    }

    chartsRef.current.oscillators = oscCharts;

    return () => {
      safeRemove(chartsRef.current.main);
      chartsRef.current.oscillators.forEach((c) => safeRemove(c));
      chartsRef.current = { main: null, oscillators: new Map() };
    };
  }, [candles, activeIndicators, activeOscillators]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!mainRef.current) return;
      const w = mainRef.current.clientWidth;
      try { chartsRef.current.main?.applyOptions({ width: w }); } catch {}
      chartsRef.current.oscillators.forEach((c) => {
        try { c.applyOptions({ width: w }); } catch {}
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="space-y-0">
      {/* Main chart */}
      <div className="border border-border rounded-t-xl overflow-hidden">
        <div ref={mainRef} />
      </div>

      {/* Oscillator panes */}
      {activeOscillators.map((ind, idx) => {
        const isLast = idx === activeOscillators.length - 1;
        return (
          <div
            key={ind.id}
            className={`border-x border-b border-border overflow-hidden ${isLast ? "rounded-b-xl" : ""}`}
          >
            <div className="px-3 py-1 bg-bg-secondary border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
              <span className="text-[10px] text-text-tertiary font-mono uppercase">{ind.label}</span>
            </div>
            <div
              ref={(el) => {
                if (el) oscRefs.current.set(ind.id, el);
              }}
            />
          </div>
        );
      })}

      {/* Bottom border if no oscillators */}
      {activeOscillators.length === 0 && (
        <style>{`.space-y-0 > div:first-child { border-radius: 0.75rem !important; }`}</style>
      )}
    </div>
  );
}
