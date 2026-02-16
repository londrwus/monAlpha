import { NextRequest, NextResponse } from "next/server";
import {
  createStrategy,
  getAllStrategies,
  deleteStrategy,
  getAlerts,
} from "@/lib/trading/strategies";

// ---------------------------------------------------------------------------
// GET /api/trading/strategies?wallet=0x...
// Returns strategies (optionally filtered by wallet) + recent alerts
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet") || undefined;

    const strategies = getAllStrategies(wallet);
    const alerts = wallet
      ? getAlerts(undefined, 100).filter(
          (a) =>
            strategies.some((s) => s.id === a.strategyId)
        )
      : getAlerts(undefined, 100);

    const activeCount = strategies.filter((s) => s.active).length;

    return NextResponse.json({ strategies, alerts, activeCount });
  } catch (err) {
    console.error("[GET /api/trading/strategies]", err);
    return NextResponse.json(
      { error: "Failed to fetch strategies" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/trading/strategies
// Creates a new strategy
// Body: { name, tokenAddress, tokenSymbol, tokenName, createdBy, conditions, actions }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, tokenAddress, tokenSymbol, tokenName, createdBy, conditions, actions } = body as {
      name?: string;
      tokenAddress?: string;
      tokenSymbol?: string;
      tokenName?: string;
      createdBy?: string;
      conditions?: Record<string, unknown>;
      actions?: Record<string, unknown>;
    };

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!tokenAddress || typeof tokenAddress !== "string") {
      return NextResponse.json({ error: "tokenAddress is required" }, { status: 400 });
    }
    if (!tokenSymbol || typeof tokenSymbol !== "string") {
      return NextResponse.json({ error: "tokenSymbol is required" }, { status: 400 });
    }
    if (!tokenName || typeof tokenName !== "string") {
      return NextResponse.json({ error: "tokenName is required" }, { status: 400 });
    }
    if (!createdBy || typeof createdBy !== "string") {
      return NextResponse.json({ error: "createdBy is required" }, { status: 400 });
    }
    if (!conditions || typeof conditions !== "object") {
      return NextResponse.json({ error: "conditions is required" }, { status: 400 });
    }
    if (!actions || typeof actions !== "object") {
      return NextResponse.json({ error: "actions is required" }, { status: 400 });
    }

    // Validate conditions fields
    const validIntervals = ["30m", "1h", "4h", "12h", "24h"];
    if (!validIntervals.includes(conditions.checkInterval as string)) {
      return NextResponse.json(
        { error: `checkInterval must be one of: ${validIntervals.join(", ")}` },
        { status: 400 }
      );
    }

    const strategy = createStrategy({
      name: name.trim(),
      tokenAddress,
      tokenSymbol,
      tokenName,
      createdBy,
      conditions: {
        checkInterval: conditions.checkInterval as "30m" | "1h" | "4h" | "12h" | "24h",
        scoreThreshold: Number(conditions.scoreThreshold) || 50,
        riskThreshold: Number(conditions.riskThreshold) || 70,
        priceDropPercent: Number(conditions.priceDropPercent) || 10,
        volumeSpikeFactor: Number(conditions.volumeSpikeFactor) || 3,
        holderDropPercent: Number(conditions.holderDropPercent) || 5,
      },
      actions: {
        alertOnTrigger: Boolean(actions.alertOnTrigger ?? true),
        autoAnalyze: Boolean(actions.autoAnalyze ?? true),
        recommendSell: Boolean(actions.recommendSell ?? true),
        recommendBuy: Boolean(actions.recommendBuy ?? false),
      },
    });

    return NextResponse.json({ strategy }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/trading/strategies]", err);
    return NextResponse.json(
      { error: "Failed to create strategy" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/trading/strategies
// Deletes a strategy and its associated alerts
// Body: { id: string }
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id } = body as { id?: string };
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const deleted = deleteStrategy(id);
    if (!deleted) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    console.error("[DELETE /api/trading/strategies]", err);
    return NextResponse.json(
      { error: "Failed to delete strategy" },
      { status: 500 }
    );
  }
}
