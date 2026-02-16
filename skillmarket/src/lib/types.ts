// === nad.fun API raw response wrappers ===

export interface NadTokenInfoRaw {
  token_info: {
    id: string;
    name: string;
    symbol: string;
    image_uri: string;
    description: string;
    creator: string;
    is_graduated: boolean;
    created_at: string;
    token_address: string;
  };
}

export interface NadMarketDataRaw {
  market_info: {
    market_type: string;
    price_usd: number;
    price_mon: number;
    market_cap_usd: number;
    holder_count: number;
    volume: number;
    ath_price: number;
    ath_date: string;
  };
}

export interface NadMetricsTimeframe {
  timeframe: string;
  percent: number;
  transactions: number;
  volume: number;
  makers: number;
}

export interface NadMetricsRaw {
  metrics: NadMetricsTimeframe[];
}

export interface NadChartRaw {
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  s: string;
}

export interface NadSwapInfo {
  event_type: string;
  native_amount: string;
  token_amount: string;
  transaction_hash: string;
  trader: string;
  price_usd: number;
  timestamp: string;
}

export interface NadSwapHistoryRaw {
  swaps: Array<{
    swap_info: NadSwapInfo;
  }>;
  total_count: number;
}

export interface NadHoldingToken {
  token_info: {
    name: string;
    symbol: string;
    image_uri: string;
    token_address: string;
  };
  balance_info: {
    balance: string;
    value_mon: number;
    value_usd: number;
  };
  market_info: {
    price_usd: number;
    price_mon: number;
  };
}

export interface NadHoldingsRaw {
  tokens: NadHoldingToken[];
  total_count: number;
}

export interface NadCreatedTokenRaw {
  token_info: {
    name: string;
    symbol: string;
    token_address: string;
    image_uri: string;
  };
  market_info: {
    price_usd: number;
    market_cap_usd: number;
  };
}

export interface NadCreatedTokensRaw {
  tokens: NadCreatedTokenRaw[];
  total_count: number;
}

// === On-chain types ===

export interface CurveState {
  realMonReserve: bigint;
  realTokenReserve: bigint;
  virtualMonReserve: bigint;
  virtualTokenReserve: bigint;
  k: bigint;
  targetTokenAmount: bigint;
  initVirtualMonReserve: bigint;
  initVirtualTokenReserve: bigint;
  isGraduated: boolean;
  isLocked: boolean;
}

// === Composed API response types (what our routes return) ===

export interface TokenDetailResponse {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  creator: string;
  isGraduated: boolean;
  createdAt: string;
  priceUsd: number;
  priceMon: number;
  marketCapUsd: number;
  holderCount: number;
  volume24h: number;
  athPrice: number;
  metrics: {
    m1?: NadMetricsTimeframe;
    m5?: NadMetricsTimeframe;
    h1?: NadMetricsTimeframe;
    d1?: NadMetricsTimeframe;
  };
  bondingCurve?: {
    virtualMonReserve: string;
    virtualTokenReserve: string;
    realMonReserve: string;
    realTokenReserve: string;
    isGraduated: boolean;
    isLocked: boolean;
    progress: number;
  };
}

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartResponse {
  tokenAddress: string;
  resolution: string;
  candles: OHLCVCandle[];
}

export interface TradeItem {
  txHash: string;
  type: string;
  trader: string;
  amountMon: string;
  amountToken: string;
  priceUsd: number;
  timestamp: string;
}

export interface TradesResponse {
  tokenAddress: string;
  trades: TradeItem[];
  totalCount: number;
}

export interface TrendingToken {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  creator: string;
  priceUsd: number;
  marketCapUsd: number;
  holderCount: number;
  volume: number;
}

export interface TrendingResponse {
  tokens: TrendingToken[];
  total: number;
}

export interface HoldingItem {
  tokenAddress: string;
  name: string;
  symbol: string;
  imageUrl: string;
  balance: string;
  valueMon: number;
  valueUsd: number;
  priceUsd: number;
}

export interface WalletResponse {
  address: string;
  holdings: HoldingItem[];
  totalValueMon: number;
  totalValueUsd: number;
  totalCount: number;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
}
