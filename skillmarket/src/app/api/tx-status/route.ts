import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/monad";
import type { Hash } from "viem";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");

  if (!hash) {
    return NextResponse.json({ status: "unknown", error: "Missing hash" }, { status: 400 });
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: hash as Hash });
    return NextResponse.json({
      status: receipt.status === "success" ? "success" : "reverted",
      blockNumber: Number(receipt.blockNumber),
    });
  } catch {
    // Not mined yet
    return NextResponse.json({ status: "pending" });
  }
}
