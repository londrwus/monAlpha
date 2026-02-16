import { NextRequest, NextResponse } from "next/server";
import { getPayoutSummary, getPendingRecords, markPaidOut } from "@/lib/payouts";

// Owner wallet — only this address can view/manage payouts
const OWNER_WALLET = (process.env.NEXT_PUBLIC_FOUNDATION_WALLET || "").toLowerCase();

/**
 * GET /api/payouts — View payout summary or pending records
 *
 * Query params:
 *   ?view=summary    — aggregated per-creator totals (default)
 *   ?view=pending    — all unpaid records
 *   ?creator=0x...   — filter pending records by creator
 */
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get("view") || "summary";
  const creator = req.nextUrl.searchParams.get("creator");

  if (view === "pending") {
    const records = getPendingRecords(creator || undefined);
    return NextResponse.json({ records, count: records.length });
  }

  const summary = getPayoutSummary();
  return NextResponse.json(summary);
}

/**
 * POST /api/payouts — Mark records as paid out
 *
 * Body: { recordIds: string[], payoutTxHash: string, ownerWallet: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordIds, payoutTxHash, ownerWallet } = body as {
      recordIds: string[];
      payoutTxHash: string;
      ownerWallet: string;
    };

    // Simple auth: only owner can mark payouts
    if (!ownerWallet || ownerWallet.toLowerCase() !== OWNER_WALLET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ error: "recordIds required" }, { status: 400 });
    }

    if (!payoutTxHash) {
      return NextResponse.json({ error: "payoutTxHash required" }, { status: 400 });
    }

    const count = markPaidOut(recordIds, payoutTxHash);
    return NextResponse.json({ marked: count });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
