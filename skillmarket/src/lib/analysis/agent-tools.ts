import type { CollectedTokenData } from "./types";
import type { AgentContext } from "./agent-context";
import { addFlag, hasFlag } from "./agent-context";
import { MALPHA_TOKEN } from "@/lib/constants";

/** Reduce risk for $MALPHA platform token */
function adjustForMalpha(data: CollectedTokenData, result: ToolResult): ToolResult {
  if (data.address?.toLowerCase() !== MALPHA_TOKEN) return result;
  return {
    ...result,
    riskDelta: Math.min(result.riskDelta, -3), // always safe or safer
    severity: "info",
    details: [...result.details, "Platform native token ($MALPHA) — trusted"],
  };
}

// === Agent Investigation Tools ===

export interface ToolResult {
  finding: string;
  severity: "info" | "warning" | "critical";
  riskDelta: number; // +positive = riskier, -negative = safer
  details: string[];
  triggerTools?: string[]; // suggest follow-up tools
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  shouldRun: (data: CollectedTokenData, ctx: AgentContext) => boolean;
  run: (data: CollectedTokenData, ctx: AgentContext) => ToolResult;
}

// ============================================================
// TIER 1 — Always Run (Primary Scan)
// ============================================================

const scanLiquidity: AgentTool = {
  id: "scan_liquidity",
  name: "Scan Liquidity",
  description: "Analyze bonding curve reserve, graduation progress, and price impact",
  tier: 1,
  shouldRun: () => true,
  run(data, ctx) {
    const details: string[] = [];
    let riskDelta = 0;
    const triggers: string[] = [];

    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;
    const liquidityMon = data.curveState ? Number(data.curveState.realMonReserve) / 1e18 : 0;
    const progress = data.graduationProgress ?? 0;

    if (isGrad) {
      details.push("Token has graduated to DEX — bonding curve complete");
      riskDelta = -5;
    } else if (data.curveState) {
      details.push(`Bonding curve reserve: ${liquidityMon.toFixed(2)} MON`);
      details.push(`Graduation progress: ${progress.toFixed(1)}%`);

      if (liquidityMon < 1) {
        riskDelta = 15;
        addFlag(ctx, "CRITICALLY_LOW_LIQUIDITY");
        triggers.push("investigate_price_impact");
      } else if (liquidityMon < 5) {
        riskDelta = 10;
        addFlag(ctx, "LOW_LIQUIDITY");
        triggers.push("investigate_price_impact");
      } else if (liquidityMon < 20) {
        riskDelta = 3;
      } else if (liquidityMon >= 50) {
        riskDelta = -5;
      } else {
        riskDelta = -2;
      }
    } else {
      details.push("No on-chain curve data available");
      riskDelta = 5;
    }

    // Locked check — but graduated tokens are expected to be locked (curve is done)
    if (data.curveState?.isLocked && !isGrad) {
      details.push("WARNING: Token is LOCKED (cannot trade)");
      riskDelta += 20;
      addFlag(ctx, "TOKEN_LOCKED");
    } else if (data.curveState?.isLocked && isGrad) {
      details.push("Bonding curve locked (normal for graduated tokens)");
    }

    // Price impact analysis
    if (data.priceImpact.buy1Mon !== null) {
      const q1 = Number(data.priceImpact.buy1Mon) / 1e18;
      const q100 = data.priceImpact.buy100Mon !== null ? Number(data.priceImpact.buy100Mon) / 1e18 : 0;
      if (q1 > 0 && q100 > 0) {
        const expectedLinear = q1 * 100;
        const slippage = ((expectedLinear - q100) / expectedLinear) * 100;
        details.push(`Price impact (100 MON buy): ${slippage.toFixed(1)}% slippage`);
        if (slippage > 50) {
          riskDelta += 5;
          addFlag(ctx, "HIGH_SLIPPAGE");
        }
      }
    }

    const severity = riskDelta >= 10 ? "warning" : riskDelta <= -3 ? "info" : "info";
    const finding = isGrad
      ? `Graduated token with DEX liquidity`
      : liquidityMon < 5
        ? `Low liquidity detected: ${liquidityMon.toFixed(2)} MON in bonding curve`
        : `Bonding curve healthy: ${liquidityMon.toFixed(2)} MON reserve, ${progress.toFixed(0)}% to graduation`;

    return { finding, severity, riskDelta, details, triggerTools: triggers.length > 0 ? triggers : undefined };
  },
};

const scanCreator: AgentTool = {
  id: "scan_creator",
  name: "Scan Creator",
  description: "Analyze creator wallet history, token count, and track record",
  tier: 1,
  shouldRun: () => true,
  run(data, ctx) {
    const details: string[] = [];
    let riskDelta = 0;
    const triggers: string[] = [];

    if (!data.hasApiData || !data.creator) {
      addFlag(ctx, "NO_CREATOR_DATA");
      return {
        finding: "Creator data unavailable — cannot assess deployer history",
        severity: "warning",
        riskDelta: 8,
        details: ["API data missing for creator analysis"],
      };
    }

    const count = data.creatorTokenCount;
    details.push(`Creator has deployed ${count} token(s)`);

    // Filter out the current token from creator's portfolio (addresses already normalized to lowercase)
    const otherTokens = data.creatorTokens.filter(
      (t) => t.address && t.address !== data.address
    );
    const deadTokens = otherTokens.filter((t) => t.marketCapUsd < 100);

    if (deadTokens.length > 0) {
      details.push(`${deadTokens.length} of creator's other tokens appear dead (MCap < $100)`);
      for (const dt of deadTokens.slice(0, 3)) {
        details.push(`  - ${dt.name} ($${dt.symbol}): MCap $${dt.marketCapUsd.toFixed(2)}`);
      }
    }

    // Use otherTokens count for history assessment (not creatorTokenCount which may include current)
    const priorCount = otherTokens.length;

    if (priorCount === 0) {
      riskDelta = -3;
      details.push("First-time deployer — neutral/slightly positive");
    } else if (priorCount <= 2) {
      riskDelta = 0;
      details.push("Small portfolio — normal range");
    } else if (priorCount <= 4) {
      riskDelta = 5;
      addFlag(ctx, "MULTI_DEPLOYER");
      if (deadTokens.length >= 2) triggers.push("investigate_serial_rug_pattern");
    } else {
      riskDelta = 12;
      addFlag(ctx, "SERIAL_DEPLOYER");
      triggers.push("investigate_serial_rug_pattern");
      details.push("Serial deployer pattern — elevated risk");
    }

    if (deadTokens.length >= 3) {
      riskDelta += 5;
      addFlag(ctx, "DEAD_TOKENS_FOUND");
    }

    const finding = priorCount > 4
      ? `Serial deployer: ${count} tokens created, ${deadTokens.length} dead`
      : priorCount === 0
        ? "First-time creator — no prior token history"
        : `Creator has ${count} tokens, ${deadTokens.length} appear inactive`;

    return {
      finding,
      severity: riskDelta >= 10 ? "warning" : "info",
      riskDelta,
      details,
      triggerTools: triggers.length > 0 ? triggers : undefined,
    };
  },
};

const scanTradingActivity: AgentTool = {
  id: "scan_trading_activity",
  name: "Scan Trading Activity",
  description: "Analyze buy/sell ratio, unique traders, and volume patterns",
  tier: 1,
  shouldRun: () => true,
  run(data, ctx) {
    const details: string[] = [];
    let riskDelta = 0;
    const triggers: string[] = [];

    const total = data.trades.length;
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;

    if (total === 0) {
      addFlag(ctx, "NO_TRADES");

      // Graduated tokens trade on DEX, not bonding curve — 0 curve trades is expected
      if (isGrad) {
        return {
          finding: "Token graduated to DEX — bonding curve swap history empty (trading continues on DEX)",
          severity: "info",
          riskDelta: 0,
          details: [
            "Graduated tokens trade on DEX, not bonding curve",
            "Swap history only covers bonding curve period",
            data.volume24h > 0 ? `24h DEX volume: $${data.volume24h.toLocaleString()}` : "No volume data from market API",
          ],
        };
      }

      return {
        finding: "No trade history available — cannot assess trading patterns",
        severity: "warning",
        riskDelta: 5,
        details: ["Zero trades recorded"],
      };
    }

    const buys = data.trades.filter((t) => t.type === "BUY").length;
    const sells = total - buys;
    const buyRatio = buys / total;
    const uniqueTraders = new Set(data.trades.filter((t) => t.trader).map((t) => t.trader.toLowerCase())).size;

    details.push(`${total} trades: ${buys} buys, ${sells} sells (${(buyRatio * 100).toFixed(0)}% buy ratio)`);
    details.push(`${uniqueTraders} unique traders`);

    // Buy/sell ratio analysis
    if (buyRatio > 0.85) {
      riskDelta = 8;
      addFlag(ctx, "PUMP_PATTERN");
      triggers.push("investigate_buy_sell_imbalance");
      details.push("One-sided buy pressure — potential coordinated pump");
    } else if (buyRatio < 0.2) {
      riskDelta = 12;
      addFlag(ctx, "DUMP_PATTERN");
      triggers.push("investigate_buy_sell_imbalance");
      details.push("Heavy sell pressure — potential dump in progress");
    } else if (buyRatio >= 0.35 && buyRatio <= 0.65) {
      riskDelta = -5;
      details.push("Healthy two-way market");
    }

    // Unique trader analysis
    if (uniqueTraders < 3) {
      riskDelta += 8;
      addFlag(ctx, "FEW_TRADERS");
      triggers.push("investigate_whale_concentration");
      details.push("Extremely few unique traders — concentrated activity");
    } else if (uniqueTraders < 10) {
      riskDelta += 3;
      addFlag(ctx, "LOW_TRADER_COUNT");
      triggers.push("investigate_whale_concentration");
    } else if (uniqueTraders >= 25) {
      riskDelta -= 3;
      details.push("Good trader diversity");
    }

    // Check for suspicious same-amount trades (wash trading signal)
    const amounts = data.trades.map((t) => t.amountMon);
    const amountCounts = new Map<string, number>();
    for (const a of amounts) {
      amountCounts.set(a, (amountCounts.get(a) || 0) + 1);
    }
    const repeatedAmounts = Array.from(amountCounts.entries()).filter(([, c]) => c >= 3);
    if (repeatedAmounts.length >= 2 && total >= 5) {
      addFlag(ctx, "REPEATED_AMOUNTS");
      triggers.push("investigate_wash_trading");
      details.push(`${repeatedAmounts.length} trade amounts repeated 3+ times — possible wash trading`);
    }

    const finding = buyRatio > 0.85
      ? `Pump signal: ${(buyRatio * 100).toFixed(0)}% buys across ${total} trades by ${uniqueTraders} traders`
      : buyRatio < 0.2
        ? `Dump signal: ${((1 - buyRatio) * 100).toFixed(0)}% sells, ${uniqueTraders} traders`
        : `${total} trades by ${uniqueTraders} unique traders, ${(buyRatio * 100).toFixed(0)}% buy ratio`;

    return {
      finding,
      severity: riskDelta >= 8 ? "warning" : "info",
      riskDelta,
      details,
      triggerTools: triggers.length > 0 ? triggers : undefined,
    };
  },
};

const scanTokenMaturity: AgentTool = {
  id: "scan_token_maturity",
  name: "Scan Token Maturity",
  description: "Analyze token age, holder count, and market cap stage",
  tier: 1,
  shouldRun: () => true,
  run(data, ctx) {
    const details: string[] = [];
    let riskDelta = 0;
    const isGrad = data.curveState?.isGraduated || data.isGraduatedApi;

    // Age — createdAt is already parsed to ISO string by collector (empty if unparseable)
    let ageHours = -1;
    if (data.createdAt) {
      const createdMs = new Date(data.createdAt).getTime();
      if (!isNaN(createdMs) && createdMs > 0) {
        const ageMs = Date.now() - createdMs;
        ageHours = ageMs / (1000 * 60 * 60);

        // Sanity: Monad tokens can't be older than ~2 years (since 2024)
        if (ageHours > 17520) {
          // > 2 years — data error
          details.push("Token creation date appears invalid (pre-Monad)");
          addFlag(ctx, "INVALID_DATE");
          ageHours = -1;
          riskDelta += 3;
        } else if (ageHours < 0) {
          // Future date
          details.push("Token creation date is in the future — data error");
          ageHours = -1;
          riskDelta += 3;
        } else if (ageHours < 1) {
          details.push(`Token age: ${Math.round(ageHours * 60)} minutes — extremely new`);
          riskDelta += 8;
          addFlag(ctx, "VERY_NEW_TOKEN");
        } else if (ageHours < 6) {
          details.push(`Token age: ${ageHours.toFixed(1)} hours — very new`);
          riskDelta += 5;
        } else if (ageHours < 24) {
          details.push(`Token age: ${ageHours.toFixed(1)} hours`);
          riskDelta += 2;
        } else if (ageHours < 168) {
          details.push(`Token age: ${(ageHours / 24).toFixed(1)} days`);
          riskDelta -= 2;
        } else {
          details.push(`Token age: ${(ageHours / 24).toFixed(0)} days — established`);
          riskDelta -= 5;
        }
      } else {
        details.push("Token creation date could not be parsed");
        riskDelta += 3;
      }
    } else {
      details.push("Token creation date unknown");
      riskDelta += 3;
    }

    // Holder count
    const holders = data.holderCount;
    if (holders > 0) {
      details.push(`${holders.toLocaleString()} holders`);
      if (holders < 5) {
        riskDelta += 5;
        addFlag(ctx, "FEW_HOLDERS");
      } else if (holders < 20) {
        riskDelta += 2;
      } else if (holders >= 100) {
        riskDelta -= 3;
        details.push("Strong holder base");
      }
    } else if (data.hasApiData) {
      details.push("Zero holders reported");
      riskDelta += 5;
    }

    // Market cap stage
    if (data.marketCapUsd > 0) {
      details.push(`Market cap: $${data.marketCapUsd.toLocaleString()}`);
      if (data.marketCapUsd < 100) {
        riskDelta += 3;
        addFlag(ctx, "MICRO_CAP");
      } else if (data.marketCapUsd > 10000) {
        riskDelta -= 2;
      }
    } else if (isGrad && holders > 100) {
      // Graduated token with many holders but $0 mcap — API data issue
      details.push("Market cap: $0 (API data may be stale for graduated tokens)");
      addFlag(ctx, "STALE_MARKET_DATA");
    }

    // Volume
    if (data.volume24h > 0) {
      details.push(`24h volume: $${data.volume24h.toLocaleString()}`);
    }

    // Data quality warning: graduated token with 0 trades but high holders
    if (isGrad && data.trades.length === 0 && holders > 50) {
      details.push("Note: Graduated token — bonding curve data may not reflect current DEX activity");
    }

    const finding = ageHours >= 0
      ? ageHours < 6
        ? `Very new token (${ageHours < 1 ? Math.round(ageHours * 60) + " min" : ageHours.toFixed(1) + "h"}) with ${holders.toLocaleString()} holders`
        : `${(ageHours / 24).toFixed(1)} day old token with ${holders.toLocaleString()} holders${data.marketCapUsd > 0 ? `, $${data.marketCapUsd.toLocaleString()} MCap` : ""}`
      : `${holders.toLocaleString()} holders${isGrad ? " (graduated to DEX)" : ""}${data.marketCapUsd > 0 ? `, $${data.marketCapUsd.toLocaleString()} MCap` : ""}`;

    return {
      finding,
      severity: riskDelta >= 8 ? "warning" : "info",
      riskDelta,
      details,
    };
  },
};

// ============================================================
// TIER 2 — Conditional (Triggered by Tier 1 findings)
// ============================================================

const investigateWhaleConcentration: AgentTool = {
  id: "investigate_whale_concentration",
  name: "Investigate Whale Concentration",
  description: "Deep analysis of trader concentration and whale dominance",
  tier: 2,
  shouldRun: (_data, ctx) =>
    hasFlag(ctx, "FEW_TRADERS") || hasFlag(ctx, "LOW_TRADER_COUNT") || hasFlag(ctx, "FEW_HOLDERS"),
  run(data, ctx) {
    const details: string[] = [];
    let riskDelta = 0;
    const triggers: string[] = [];

    const traderVolumes = new Map<string, number>();
    for (const t of data.trades) {
      if (!t.trader) continue;
      const addr = t.trader.toLowerCase();
      const amt = Number(t.amountMon) / 1e18;
      traderVolumes.set(addr, (traderVolumes.get(addr) || 0) + amt);
    }

    const sorted = Array.from(traderVolumes.entries()).sort((a, b) => b[1] - a[1]);
    const totalVol = sorted.reduce((s, [, v]) => s + v, 0);

    if (sorted.length === 0) {
      return { finding: "No trader data to analyze", severity: "info", riskDelta: 0, details: [] };
    }

    // Top trader dominance
    const topTraderVol = sorted[0][1];
    const topTraderPct = totalVol > 0 ? (topTraderVol / totalVol) * 100 : 0;
    details.push(`Top trader: ${sorted[0][0].slice(0, 10)}... controls ${topTraderPct.toFixed(1)}% of volume`);

    // Top 3 concentration
    const top3Vol = sorted.slice(0, 3).reduce((s, [, v]) => s + v, 0);
    const top3Pct = totalVol > 0 ? (top3Vol / totalVol) * 100 : 0;
    details.push(`Top 3 traders control ${top3Pct.toFixed(1)}% of total volume`);

    if (topTraderPct > 60) {
      riskDelta = 12;
      addFlag(ctx, "WHALE_DOMINATED");
      details.push("Single whale dominates trading — high manipulation risk");
      if (hasFlag(ctx, "PUMP_PATTERN")) triggers.push("investigate_coordinated_pump");
    } else if (top3Pct > 80) {
      riskDelta = 8;
      addFlag(ctx, "CONCENTRATED_TRADING");
      details.push("Top 3 traders control most volume");
    } else if (top3Pct < 50) {
      riskDelta = -3;
      details.push("Trading volume well distributed");
    }

    // Creator trading check
    if (data.creator) {
      const creatorVol = traderVolumes.get(data.creator.toLowerCase()) || 0;
      if (creatorVol > 0) {
        const creatorPct = (creatorVol / totalVol) * 100;
        details.push(`Creator has traded: ${creatorPct.toFixed(1)}% of volume`);
        if (creatorPct > 30) {
          riskDelta += 5;
          details.push("Creator is a major trader — potential self-dealing");
        }
      }
    }

    return {
      finding: topTraderPct > 60
        ? `Whale alert: top trader controls ${topTraderPct.toFixed(0)}% of volume`
        : `Top 3 traders control ${top3Pct.toFixed(0)}% of volume`,
      severity: riskDelta >= 8 ? "critical" : riskDelta >= 3 ? "warning" : "info",
      riskDelta,
      details,
      triggerTools: triggers.length > 0 ? triggers : undefined,
    };
  },
};

const investigatePriceImpact: AgentTool = {
  id: "investigate_price_impact",
  name: "Investigate Price Impact",
  description: "Deep analysis of slippage and liquidity depth across trade sizes",
  tier: 2,
  shouldRun: (_data, ctx) =>
    hasFlag(ctx, "LOW_LIQUIDITY") || hasFlag(ctx, "CRITICALLY_LOW_LIQUIDITY") || hasFlag(ctx, "HIGH_SLIPPAGE"),
  run(data) {
    const details: string[] = [];
    let riskDelta = 0;

    const q1 = data.priceImpact.buy1Mon !== null ? Number(data.priceImpact.buy1Mon) / 1e18 : 0;
    const q10 = data.priceImpact.buy10Mon !== null ? Number(data.priceImpact.buy10Mon) / 1e18 : 0;
    const q100 = data.priceImpact.buy100Mon !== null ? Number(data.priceImpact.buy100Mon) / 1e18 : 0;

    if (q1 > 0) {
      details.push(`1 MON buys: ${q1.toFixed(2)} tokens`);
      if (q10 > 0) {
        const expected10 = q1 * 10;
        const slippage10 = ((expected10 - q10) / expected10) * 100;
        details.push(`10 MON buy slippage: ${slippage10.toFixed(1)}%`);
      }
      if (q100 > 0) {
        const expected100 = q1 * 100;
        const slippage100 = ((expected100 - q100) / expected100) * 100;
        details.push(`100 MON buy slippage: ${slippage100.toFixed(1)}%`);

        if (slippage100 > 80) {
          riskDelta = 10;
          details.push("Extreme slippage — virtually no liquidity for larger trades");
        } else if (slippage100 > 50) {
          riskDelta = 5;
          details.push("High slippage — difficult to exit position at size");
        } else if (slippage100 < 20) {
          riskDelta = -3;
          details.push("Good liquidity depth — reasonable slippage");
        }
      }
    } else {
      details.push("Price impact quotes unavailable");
      riskDelta = 3;
    }

    // Graduation proximity
    const progress = data.graduationProgress ?? 0;
    if (progress > 80) {
      details.push(`Near graduation (${progress.toFixed(0)}%) — liquidity will migrate to DEX`);
      riskDelta -= 2;
    }

    const slippage = q1 > 0 && q100 > 0 ? ((q1 * 100 - q100) / (q1 * 100)) * 100 : -1;
    return {
      finding: slippage >= 0
        ? `Price impact analysis: ${slippage.toFixed(0)}% slippage on 100 MON trade`
        : "Price impact data insufficient for analysis",
      severity: riskDelta >= 5 ? "warning" : "info",
      riskDelta,
      details,
    };
  },
};

const investigateWashTrading: AgentTool = {
  id: "investigate_wash_trading",
  name: "Investigate Wash Trading",
  description: "Detect self-trading, round-trip patterns, and artificial volume",
  tier: 2,
  shouldRun: (_data, ctx) => hasFlag(ctx, "REPEATED_AMOUNTS"),
  run(data) {
    const details: string[] = [];
    let riskDelta = 0;

    // Check for same wallet doing buy→sell patterns
    const traderActions = new Map<string, { buys: number; sells: number; totalMon: number }>();
    for (const t of data.trades) {
      if (!t.trader) continue;
      const addr = t.trader.toLowerCase();
      const entry = traderActions.get(addr) || { buys: 0, sells: 0, totalMon: 0 };
      if (t.type === "BUY") entry.buys++;
      else entry.sells++;
      entry.totalMon += Number(t.amountMon) / 1e18;
      traderActions.set(addr, entry);
    }

    // Find wallets doing both buy and sell (round-trip)
    const roundTrips = Array.from(traderActions.entries()).filter(
      ([, v]) => v.buys > 0 && v.sells > 0
    );
    details.push(`${roundTrips.length} wallet(s) performed both buys and sells`);

    if (roundTrips.length > 0) {
      const rtVol = roundTrips.reduce((s, [, v]) => s + v.totalMon, 0);
      const totalVol = Array.from(traderActions.values()).reduce((s, v) => s + v.totalMon, 0);
      const rtPct = totalVol > 0 ? (rtVol / totalVol) * 100 : 0;
      details.push(`Round-trip traders account for ${rtPct.toFixed(0)}% of volume`);

      if (rtPct > 60) {
        riskDelta = 10;
        details.push("Majority of volume appears to be wash trading");
      } else if (rtPct > 30) {
        riskDelta = 5;
        details.push("Significant portion of volume may be artificial");
      }
    }

    // Check for repeated exact amounts
    const amounts = data.trades.map((t) => t.amountMon);
    const freq = new Map<string, number>();
    for (const a of amounts) freq.set(a, (freq.get(a) || 0) + 1);
    const suspicious = Array.from(freq.entries())
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (suspicious.length > 0) {
      for (const [amt, count] of suspicious.slice(0, 3)) {
        details.push(`Amount ${(Number(amt) / 1e18).toFixed(4)} MON repeated ${count} times`);
      }
      riskDelta += Math.min(5, suspicious.length * 2);
    }

    return {
      finding: riskDelta >= 5
        ? `Wash trading signals detected: ${roundTrips.length} round-trip wallets, ${suspicious.length} repeated amounts`
        : `Trading patterns appear organic — ${roundTrips.length} round-trip traders`,
      severity: riskDelta >= 5 ? "warning" : "info",
      riskDelta,
      details,
    };
  },
};

const investigateBuySellImbalance: AgentTool = {
  id: "investigate_buy_sell_imbalance",
  name: "Investigate Buy/Sell Imbalance",
  description: "Deep analysis of extreme buy or sell pressure patterns",
  tier: 2,
  shouldRun: (_data, ctx) => hasFlag(ctx, "PUMP_PATTERN") || hasFlag(ctx, "DUMP_PATTERN"),
  run(data, ctx) {
    const details: string[] = [];
    let riskDelta = 0;
    const triggers: string[] = [];

    const buys = data.trades.filter((t) => t.type === "BUY");
    const sells = data.trades.filter((t) => t.type === "SELL");

    let buyVolMon = 0;
    let sellVolMon = 0;
    for (const t of data.trades) {
      const amt = Number(t.amountMon) / 1e18;
      if (t.type === "BUY") buyVolMon += amt;
      else sellVolMon += amt;
    }

    details.push(`Buy volume: ${buyVolMon.toFixed(2)} MON (${buys.length} trades)`);
    details.push(`Sell volume: ${sellVolMon.toFixed(2)} MON (${sells.length} trades)`);

    const totalVol = buyVolMon + sellVolMon;
    const buyVolPct = totalVol > 0 ? (buyVolMon / totalVol) * 100 : 50;

    if (hasFlag(ctx, "PUMP_PATTERN")) {
      // Analyze buy pattern
      const avgBuySize = buys.length > 0 ? buyVolMon / buys.length : 0;
      details.push(`Average buy size: ${avgBuySize.toFixed(4)} MON`);

      // Check if buys are from few wallets (coordinated)
      const buyWallets = new Set(buys.map((t) => t.trader?.toLowerCase()).filter(Boolean));
      details.push(`${buyWallets.size} unique buy wallets`);

      if (buyWallets.size <= 3 && buys.length >= 5) {
        riskDelta = 10;
        details.push("Concentrated buy activity from few wallets — likely coordinated");
        if (hasFlag(ctx, "WHALE_DOMINATED") || hasFlag(ctx, "CONCENTRATED_TRADING")) {
          triggers.push("investigate_coordinated_pump");
        }
      } else {
        riskDelta = 3;
        details.push("Buys spread across multiple wallets — less likely coordinated");
      }
    }

    if (hasFlag(ctx, "DUMP_PATTERN")) {
      const avgSellSize = sells.length > 0 ? sellVolMon / sells.length : 0;
      details.push(`Average sell size: ${avgSellSize.toFixed(4)} MON`);

      const sellWallets = new Set(sells.map((t) => t.trader?.toLowerCase()).filter(Boolean));
      details.push(`${sellWallets.size} unique sell wallets`);

      if (hasFlag(ctx, "LOW_LIQUIDITY") || hasFlag(ctx, "CRITICALLY_LOW_LIQUIDITY")) {
        riskDelta = 12;
        triggers.push("investigate_dump_risk");
        details.push("Dump pattern with low liquidity — exit may be impossible");
      } else {
        riskDelta = 5;
      }
    }

    return {
      finding: hasFlag(ctx, "PUMP_PATTERN")
        ? `Buy pressure: ${buyVolPct.toFixed(0)}% of volume is buys from ${new Set(buys.map((t) => t.trader?.toLowerCase())).size} wallets`
        : `Sell pressure: ${(100 - buyVolPct).toFixed(0)}% of volume is sells`,
      severity: riskDelta >= 8 ? "critical" : "warning",
      riskDelta,
      details,
      triggerTools: triggers.length > 0 ? triggers : undefined,
    };
  },
};

// ============================================================
// TIER 3 — Composite (Cross-tool patterns)
// ============================================================

const investigateSerialRugPattern: AgentTool = {
  id: "investigate_serial_rug_pattern",
  name: "Investigate Serial Rug Pattern",
  description: "Cross-reference creator history with current token health indicators",
  tier: 3,
  shouldRun: (_data, ctx) =>
    (hasFlag(ctx, "SERIAL_DEPLOYER") || hasFlag(ctx, "MULTI_DEPLOYER")) && hasFlag(ctx, "DEAD_TOKENS_FOUND"),
  run(data) {
    const details: string[] = [];

    // Addresses already normalized to lowercase in collector
    const otherTokens = data.creatorTokens.filter(
      (t) => t.address && t.address !== data.address
    );
    const deadTokens = otherTokens.filter((t) => t.marketCapUsd < 100);
    const aliveTokens = otherTokens.filter((t) => t.marketCapUsd >= 100);

    details.push(`Creator's portfolio: ${data.creatorTokenCount} total tokens`);
    details.push(`  Dead/abandoned: ${deadTokens.length}`);
    details.push(`  Active: ${aliveTokens.length}`);

    const deadRatio = data.creatorTokenCount > 1
      ? deadTokens.length / (data.creatorTokenCount - 1)
      : 0;

    let riskDelta: number;
    if (deadRatio > 0.8 && deadTokens.length >= 3) {
      riskDelta = 15;
      details.push("CRITICAL: >80% of creator's tokens are dead — classic rug pattern");
    } else if (deadRatio > 0.5) {
      riskDelta = 8;
      details.push("Majority of creator's tokens have failed");
    } else {
      riskDelta = 3;
      details.push("Creator has mixed track record");
    }

    return {
      finding: `Serial rug analysis: ${deadTokens.length}/${data.creatorTokenCount - 1} previous tokens dead (${(deadRatio * 100).toFixed(0)}% failure rate)`,
      severity: riskDelta >= 10 ? "critical" : "warning",
      riskDelta,
      details,
    };
  },
};

const investigateCoordinatedPump: AgentTool = {
  id: "investigate_coordinated_pump",
  name: "Investigate Coordinated Pump",
  description: "Cross-reference whale activity with pump patterns for coordination signals",
  tier: 3,
  shouldRun: (_data, ctx) =>
    hasFlag(ctx, "PUMP_PATTERN") &&
    (hasFlag(ctx, "WHALE_DOMINATED") || hasFlag(ctx, "CONCENTRATED_TRADING")),
  run(data) {
    const details: string[] = [];

    // Analyze timing of buys
    const buyTrades = data.trades.filter((t) => t.type === "BUY" && t.timestamp);
    if (buyTrades.length >= 3) {
      const timestamps = buyTrades
        .map((t) => new Date(t.timestamp).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);

      if (timestamps.length >= 3) {
        const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i]);
        const avgGapMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const avgGapSec = avgGapMs / 1000;

        details.push(`Average time between buys: ${avgGapSec.toFixed(0)}s`);

        if (avgGapSec < 10) {
          details.push("Extremely rapid buy sequence — likely bot/script");
        } else if (avgGapSec < 60) {
          details.push("Rapid buy clustering — possible coordination");
        }
      }
    }

    // Cross-reference: concentrated buyers doing most volume
    const buyerVols = new Map<string, number>();
    for (const t of buyTrades) {
      if (!t.trader) continue;
      const addr = t.trader.toLowerCase();
      buyerVols.set(addr, (buyerVols.get(addr) || 0) + Number(t.amountMon) / 1e18);
    }

    const sortedBuyers = Array.from(buyerVols.entries()).sort((a, b) => b[1] - a[1]);
    const totalBuyVol = sortedBuyers.reduce((s, [, v]) => s + v, 0);

    if (sortedBuyers.length > 0) {
      const top1Pct = totalBuyVol > 0 ? (sortedBuyers[0][1] / totalBuyVol) * 100 : 0;
      details.push(`Top buyer controls ${top1Pct.toFixed(0)}% of buy volume`);
    }

    const riskDelta = 10;
    return {
      finding: `Coordinated pump suspected: concentrated whale buying with ${(data.trades.filter((t) => t.type === "BUY").length / data.trades.length * 100).toFixed(0)}% buy ratio`,
      severity: "critical",
      riskDelta,
      details,
    };
  },
};

const investigateDumpRisk: AgentTool = {
  id: "investigate_dump_risk",
  name: "Investigate Dump Risk",
  description: "Assess combined dump pressure with low liquidity exit risk",
  tier: 3,
  shouldRun: (_data, ctx) =>
    hasFlag(ctx, "DUMP_PATTERN") &&
    (hasFlag(ctx, "LOW_LIQUIDITY") || hasFlag(ctx, "CRITICALLY_LOW_LIQUIDITY")),
  run(data) {
    const details: string[] = [];

    const liquidityMon = data.curveState ? Number(data.curveState.realMonReserve) / 1e18 : 0;
    const sells = data.trades.filter((t) => t.type === "SELL");
    let sellVol = 0;
    for (const t of sells) sellVol += Number(t.amountMon) / 1e18;

    details.push(`Current liquidity: ${liquidityMon.toFixed(2)} MON`);
    details.push(`Recent sell volume: ${sellVol.toFixed(2)} MON across ${sells.length} sells`);

    const liquidityRatio = liquidityMon > 0 ? sellVol / liquidityMon : 999;
    details.push(`Sell volume / liquidity ratio: ${liquidityRatio.toFixed(2)}x`);

    if (liquidityRatio > 2) {
      details.push("CRITICAL: Sell volume far exceeds available liquidity — likely draining");
    } else if (liquidityRatio > 0.5) {
      details.push("Sell pressure is significant relative to liquidity");
    }

    const riskDelta = liquidityRatio > 2 ? 15 : liquidityRatio > 0.5 ? 8 : 3;

    return {
      finding: `Dump risk: ${sellVol.toFixed(2)} MON in sells against ${liquidityMon.toFixed(2)} MON liquidity (${liquidityRatio.toFixed(1)}x ratio)`,
      severity: riskDelta >= 10 ? "critical" : "warning",
      riskDelta,
      details,
    };
  },
};

// ============================================================
// Tool Registry
// ============================================================

/** Wrap a tool so $MALPHA always gets favorable risk deltas */
function wrapTool(tool: AgentTool): AgentTool {
  return {
    ...tool,
    run(data, ctx) {
      const result = tool.run(data, ctx);
      return adjustForMalpha(data, result);
    },
  };
}

export const allTools: AgentTool[] = [
  // Tier 1
  wrapTool(scanLiquidity),
  wrapTool(scanCreator),
  wrapTool(scanTradingActivity),
  wrapTool(scanTokenMaturity),
  // Tier 2
  wrapTool(investigateWhaleConcentration),
  wrapTool(investigatePriceImpact),
  wrapTool(investigateWashTrading),
  wrapTool(investigateBuySellImbalance),
  // Tier 3
  wrapTool(investigateSerialRugPattern),
  wrapTool(investigateCoordinatedPump),
  wrapTool(investigateDumpRisk),
];

export function getToolsByTier(tier: 1 | 2 | 3): AgentTool[] {
  return allTools.filter((t) => t.tier === tier);
}

export function getToolById(id: string): AgentTool | undefined {
  return allTools.find((t) => t.id === id);
}
