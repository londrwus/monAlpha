import { JsonStore } from "./storage/json-store";

export interface PayoutRecord {
  id: string;
  modelId: string;
  modelName: string;
  creatorWallet: string;
  amountMon: number;       // MON owed to creator for this usage
  userWallet: string;      // who paid
  txHash: string;          // payment tx
  paidOut: boolean;        // has creator been paid?
  payoutTxHash?: string;   // tx when creator was paid
  timestamp: number;
}

interface PayoutLedger {
  records: PayoutRecord[];
}

const store = new JsonStore<PayoutLedger>("payouts.json", { records: [] });

/**
 * Record a usage payment — tracks what each creator is owed.
 * Call this after the user pays for analysis.
 */
export function recordUsagePayment(params: {
  modelId: string;
  modelName: string;
  creatorWallet: string;
  amountMon: number;
  userWallet: string;
  txHash: string;
}): PayoutRecord {
  const record: PayoutRecord = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    modelId: params.modelId,
    modelName: params.modelName,
    creatorWallet: params.creatorWallet.toLowerCase(),
    amountMon: params.amountMon,
    userWallet: params.userWallet.toLowerCase(),
    txHash: params.txHash,
    paidOut: false,
    timestamp: Date.now(),
  };

  store.update((data) => ({
    records: [...data.records, record],
  }));

  return record;
}

/**
 * Mark records as paid out (after you manually send creator their share)
 */
export function markPaidOut(recordIds: string[], payoutTxHash: string): number {
  let count = 0;
  store.update((data) => ({
    records: data.records.map((r) => {
      if (recordIds.includes(r.id) && !r.paidOut) {
        count++;
        return { ...r, paidOut: true, payoutTxHash };
      }
      return r;
    }),
  }));
  return count;
}

/**
 * Get aggregated payout summary per creator
 */
export function getPayoutSummary(): {
  creators: {
    wallet: string;
    totalOwed: number;
    totalPaid: number;
    pendingRecords: number;
    paidRecords: number;
  }[];
  totalPending: number;
  totalPaid: number;
} {
  const { records } = store.get();
  const byCreator = new Map<string, { owed: number; paid: number; pendingCount: number; paidCount: number }>();

  for (const r of records) {
    const entry = byCreator.get(r.creatorWallet) || { owed: 0, paid: 0, pendingCount: 0, paidCount: 0 };
    if (r.paidOut) {
      entry.paid += r.amountMon;
      entry.paidCount++;
    } else {
      entry.owed += r.amountMon;
      entry.pendingCount++;
    }
    byCreator.set(r.creatorWallet, entry);
  }

  let totalPending = 0;
  let totalPaid = 0;
  const creators = Array.from(byCreator.entries()).map(([wallet, data]) => {
    totalPending += data.owed;
    totalPaid += data.paid;
    return {
      wallet,
      totalOwed: Math.round(data.owed * 1000) / 1000,
      totalPaid: Math.round(data.paid * 1000) / 1000,
      pendingRecords: data.pendingCount,
      paidRecords: data.paidCount,
    };
  });

  creators.sort((a, b) => b.totalOwed - a.totalOwed);

  return {
    creators,
    totalPending: Math.round(totalPending * 1000) / 1000,
    totalPaid: Math.round(totalPaid * 1000) / 1000,
  };
}

/**
 * Get all pending (unpaid) records, optionally filtered by creator
 */
export function getPendingRecords(creatorWallet?: string): PayoutRecord[] {
  const { records } = store.get();
  return records.filter((r) => {
    if (r.paidOut) return false;
    if (creatorWallet && r.creatorWallet !== creatorWallet.toLowerCase()) return false;
    return true;
  });
}

/**
 * Get all records (for admin view)
 */
export function getAllRecords(): PayoutRecord[] {
  return store.get().records;
}
