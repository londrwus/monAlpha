import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getHoldings } from "@/lib/nadfun";
import type { WalletResponse, HoldingItem } from "@/lib/types";

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
    const { tokens, totalCount } = await getHoldings(address);

    const holdings: HoldingItem[] = tokens.map((t) => ({
      tokenAddress: t.token_info.token_address,
      name: t.token_info.name,
      symbol: t.token_info.symbol,
      imageUrl: t.token_info.image_uri,
      balance: t.balance_info.balance,
      valueMon: t.balance_info.value_mon,
      valueUsd: t.balance_info.value_usd,
      priceUsd: t.market_info.price_usd,
    }));

    const totalValueMon = holdings.reduce((sum, h) => sum + h.valueMon, 0);
    const totalValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

    const response: WalletResponse = {
      address,
      holdings,
      totalValueMon,
      totalValueUsd,
      totalCount,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch holdings", message: String(err) },
      { status: 502 }
    );
  }
}
