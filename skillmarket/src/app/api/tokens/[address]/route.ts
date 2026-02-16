import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getTokenInfo, getMarketData, getMetrics } from "@/lib/nadfun";
import { getCurveState, getProgress } from "@/lib/onchain";
import type { TokenDetailResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address", message: "Must be a valid 0x address" },
      { status: 400 }
    );
  }

  try {
    const tokenAddr = address as Address;

    // Fetch from nad.fun API and on-chain in parallel
    const [tokenResult, marketResult, metricsResult, curveResult, progressResult] =
      await Promise.allSettled([
        getTokenInfo(address),
        getMarketData(address),
        getMetrics(address),
        getCurveState(tokenAddr),
        getProgress(tokenAddr),
      ]);

    // Token info is required — if it fails, return 404
    if (tokenResult.status === "rejected") {
      return NextResponse.json(
        { error: "Token not found", message: "Could not fetch token from nad.fun" },
        { status: 404 }
      );
    }

    const token = tokenResult.value;
    const market = marketResult.status === "fulfilled" ? marketResult.value : null;
    const metricsArr = metricsResult.status === "fulfilled" ? metricsResult.value : [];
    const curve = curveResult.status === "fulfilled" ? curveResult.value : null;
    const progress = progressResult.status === "fulfilled" ? progressResult.value : null;

    // Map metrics array to keyed object
    const metricsMap: TokenDetailResponse["metrics"] = {};
    for (const m of metricsArr) {
      if (m.timeframe === "1") metricsMap.m1 = m;
      else if (m.timeframe === "5") metricsMap.m5 = m;
      else if (m.timeframe === "60") metricsMap.h1 = m;
      else if (m.timeframe === "1D") metricsMap.d1 = m;
    }

    const response: TokenDetailResponse = {
      address,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.image_uri,
      description: token.description,
      creator: token.creator,
      isGraduated: token.is_graduated,
      createdAt: token.created_at,
      priceUsd: market?.price_usd ?? 0,
      priceMon: market?.price_mon ?? 0,
      marketCapUsd: market?.market_cap_usd ?? 0,
      holderCount: market?.holder_count ?? 0,
      volume24h: market?.volume ?? 0,
      athPrice: market?.ath_price ?? 0,
      metrics: metricsMap,
      bondingCurve: curve
        ? {
            virtualMonReserve: curve.virtualMonReserve.toString(),
            virtualTokenReserve: curve.virtualTokenReserve.toString(),
            realMonReserve: curve.realMonReserve.toString(),
            realTokenReserve: curve.realTokenReserve.toString(),
            isGraduated: curve.isGraduated,
            isLocked: curve.isLocked,
            progress: progress ?? 0,
          }
        : undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal error", message: String(err) },
      { status: 500 }
    );
  }
}
