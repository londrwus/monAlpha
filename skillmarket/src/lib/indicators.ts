export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface StochasticPoint {
  time: number;
  k: number;
  d: number;
}

// === EMA (raw helper — returns plain number[]) ===

function emaRaw(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const k = 2 / (period + 1);
  const ema: number[] = [];

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema.push(sum / period);

  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }

  return ema;
}

// === SMA ===

export function calculateSMA(candles: OHLCVCandle[], period: number): IndicatorPoint[] {
  if (candles.length < period) return [];
  const result: IndicatorPoint[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  result.push({ time: candles[period - 1].time, value: sum / period });

  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close;
    result.push({ time: candles[i].time, value: sum / period });
  }

  return result;
}

// === EMA (public) ===

export function calculateEMA(candles: OHLCVCandle[], period: number): IndicatorPoint[] {
  const closes = candles.map((c) => c.close);
  const ema = emaRaw(closes, period);
  // EMA starts at index period-1
  return ema.map((v, i) => ({ time: candles[period - 1 + i].time, value: v }));
}

// === RSI (Wilder's smoothing) ===

export function calculateRSI(candles: OHLCVCandle[], period: number = 14): IndicatorPoint[] {
  if (candles.length < period + 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    changes.push(candles[i].close - candles[i - 1].close);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const result: IndicatorPoint[] = [];
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time: candles[period].time,
    value: 100 - 100 / (1 + rs),
  });

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: candles[i + 1].time, value: rsi });
  }

  return result;
}

// === MACD ===

export function calculateMACD(
  candles: OHLCVCandle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[] {
  const closes = candles.map((c) => c.close);
  if (closes.length < slowPeriod + signalPeriod) return [];

  const fastEMA = emaRaw(closes, fastPeriod);
  const slowEMA = emaRaw(closes, slowPeriod);

  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }

  const signalLine = emaRaw(macdLine, signalPeriod);
  const signalOffset = signalPeriod - 1;

  const result: MACDPoint[] = [];
  const timeOffset = slowPeriod - 1 + signalOffset;

  for (let i = 0; i < signalLine.length; i++) {
    const macdIdx = i + signalOffset;
    const macd = macdLine[macdIdx];
    const sig = signalLine[i];
    result.push({
      time: candles[timeOffset + i].time,
      macd,
      signal: sig,
      histogram: macd - sig,
    });
  }

  return result;
}

// === Bollinger Bands ===

export function calculateBollingerBands(
  candles: OHLCVCandle[],
  period: number = 20,
  stdDevMult: number = 2
): BollingerBandsPoint[] {
  if (candles.length < period) return [];
  const result: BollingerBandsPoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    const mean = sum / period;

    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sqSum += (candles[j].close - mean) ** 2;
    }
    const stdDev = Math.sqrt(sqSum / period);

    result.push({
      time: candles[i].time,
      upper: mean + stdDevMult * stdDev,
      middle: mean,
      lower: mean - stdDevMult * stdDev,
    });
  }

  return result;
}

// === VWAP (Volume Weighted Average Price) ===

export function calculateVWAP(candles: OHLCVCandle[]): IndicatorPoint[] {
  if (candles.length === 0) return [];

  let cumVolume = 0;
  let cumTPV = 0; // cumulative (typical price * volume)

  return candles.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    cumVolume += c.volume;
    cumTPV += tp * c.volume;
    return {
      time: c.time,
      value: cumVolume > 0 ? cumTPV / cumVolume : tp,
    };
  });
}

// === Stochastic Oscillator ===

export function calculateStochastic(
  candles: OHLCVCandle[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticPoint[] {
  if (candles.length < kPeriod) return [];

  // Calculate %K (raw)
  const kValues: { time: number; k: number }[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    const k = range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100;
    kValues.push({ time: candles[i].time, k });
  }

  if (kValues.length < dPeriod) return [];

  // %D = SMA of %K
  const result: StochasticPoint[] = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    let dSum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      dSum += kValues[j].k;
    }
    result.push({
      time: kValues[i].time,
      k: kValues[i].k,
      d: dSum / dPeriod,
    });
  }

  return result;
}

// === ATR (Average True Range) ===

export function calculateATR(candles: OHLCVCandle[], period: number = 14): IndicatorPoint[] {
  if (candles.length < period + 1) return [];

  // True Range
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  // First ATR = SMA of first `period` TRs
  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += tr[i];
  }
  atr /= period;

  const result: IndicatorPoint[] = [];
  // tr[0] corresponds to candles[1], so tr[period-1] corresponds to candles[period]
  result.push({ time: candles[period].time, value: atr });

  // Wilder's smoothing
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result.push({ time: candles[i + 1].time, value: atr });
  }

  return result;
}

// === CCI (Commodity Channel Index) ===

export function calculateCCI(candles: OHLCVCandle[], period: number = 20): IndicatorPoint[] {
  if (candles.length < period) return [];

  const result: IndicatorPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    // Typical prices for the window
    let sum = 0;
    const tps: number[] = [];
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
      tps.push(tp);
      sum += tp;
    }
    const mean = sum / period;

    // Mean deviation
    let mdSum = 0;
    for (const tp of tps) {
      mdSum += Math.abs(tp - mean);
    }
    const md = mdSum / period;

    const currentTP = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const cci = md === 0 ? 0 : (currentTP - mean) / (0.015 * md);
    result.push({ time: candles[i].time, value: cci });
  }

  return result;
}

// === Williams %R ===

export function calculateWilliamsR(candles: OHLCVCandle[], period: number = 14): IndicatorPoint[] {
  if (candles.length < period) return [];

  const result: IndicatorPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    const wr = range === 0 ? -50 : ((highest - candles[i].close) / range) * -100;
    result.push({ time: candles[i].time, value: wr });
  }

  return result;
}

// === OBV (On-Balance Volume) ===

export function calculateOBV(candles: OHLCVCandle[]): IndicatorPoint[] {
  if (candles.length === 0) return [];

  const result: IndicatorPoint[] = [{ time: candles[0].time, value: candles[0].volume }];

  for (let i = 1; i < candles.length; i++) {
    const prev = result[result.length - 1].value;
    let obv = prev;
    if (candles[i].close > candles[i - 1].close) {
      obv += candles[i].volume;
    } else if (candles[i].close < candles[i - 1].close) {
      obv -= candles[i].volume;
    }
    result.push({ time: candles[i].time, value: obv });
  }

  return result;
}
