import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSwapHistory } from "@/lib/nadfun";
import type { TradesResponse, TradeItem } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address", message: "Must be a valid 0x address" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
  const tradeType = searchParams.get("trade_type") as
    | "BUY"
    | "SELL"
    | null;

  try {
    const { swaps, totalCount } = await getSwapHistory(
      address,
      limit,
      tradeType || undefined
    );

    const trades: TradeItem[] = swaps.map((s) => ({
      txHash: s.transaction_hash,
      type: s.event_type,
      trader: s.trader,
      amountMon: s.native_amount,
      amountToken: s.token_amount,
      priceUsd: s.price_usd,
      timestamp: s.timestamp,
    }));

    const response: TradesResponse = {
      tokenAddress: address,
      trades,
      totalCount,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch trades", message: String(err) },
      { status: 502 }
    );
  }
}
