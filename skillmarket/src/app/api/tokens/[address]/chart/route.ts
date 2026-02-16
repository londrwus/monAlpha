import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getChart } from "@/lib/nadfun";
import type { ChartResponse } from "@/lib/types";

// ── Server-side chart cache ──
// Caches per token+resolution for 60s so switching back and forth
// between tokens doesn't burn API budget.
const chartCache = new Map<string, { data: ChartResponse; ts: number }>();
const CHART_CACHE_TTL = 300_000; // 5 min

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
  const resolution = searchParams.get("resolution") || "60";

  // Check cache (keyed by address+resolution, ignoring from/to timestamps)
  const cacheKey = `${address.toLowerCase()}:${resolution}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CHART_CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const from = searchParams.get("from")
    ? Number(searchParams.get("from"))
    : undefined;
  const to = searchParams.get("to")
    ? Number(searchParams.get("to"))
    : undefined;

  try {
    const candles = await getChart(address, resolution, from, to);

    const response: ChartResponse = {
      tokenAddress: address,
      resolution,
      candles,
    };

    chartCache.set(cacheKey, { data: response, ts: Date.now() });
    return NextResponse.json(response);
  } catch (err) {
    // Return stale cache on error rather than failing
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(
      { error: "Failed to fetch chart data", message: String(err) },
      { status: 502 }
    );
  }
}
