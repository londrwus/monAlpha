import { type Address, parseAbi } from "viem";
import { publicClient, eventClient } from "./monad";
import { CONFIG, NAD_API_BASE } from "./constants";
import { lensAbi } from "./abis/lens";
import { curveAbi } from "./abis/curve";
import { erc20Abi } from "./abis/erc20";
import type { CurveState } from "./types";

const LENS = CONFIG.LENS as Address;
const CURVE = CONFIG.CURVE as Address;
const WMON = CONFIG.WMON as Address;

const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

/**
 * Get full bonding curve state for a token.
 * Returns null if the contract call fails.
 */
export async function getCurveState(
  tokenAddress: Address
): Promise<CurveState | null> {
  try {
    const [curveData, graduated, locked] = await Promise.all([
      publicClient.readContract({
        address: CURVE,
        abi: curveAbi,
        functionName: "curves",
        args: [tokenAddress],
      }),
      publicClient.readContract({
        address: CURVE,
        abi: curveAbi,
        functionName: "isGraduated",
        args: [tokenAddress],
      }),
      publicClient.readContract({
        address: CURVE,
        abi: curveAbi,
        functionName: "isLocked",
        args: [tokenAddress],
      }),
    ]);

    return {
      realMonReserve: curveData[0],
      realTokenReserve: curveData[1],
      virtualMonReserve: curveData[2],
      virtualTokenReserve: curveData[3],
      k: curveData[4],
      targetTokenAmount: curveData[5],
      initVirtualMonReserve: curveData[6],
      initVirtualTokenReserve: curveData[7],
      isGraduated: graduated,
      isLocked: locked,
    };
  } catch {
    return null;
  }
}

/**
 * Get graduation progress (0-100) for a token.
 * Returns null on failure.
 */
export async function getProgress(
  tokenAddress: Address
): Promise<number | null> {
  try {
    const progress = await publicClient.readContract({
      address: LENS,
      abi: lensAbi,
      functionName: "getProgress",
      args: [tokenAddress],
    });
    // progress is 0-10000, convert to 0-100
    return Number(progress) / 100;
  } catch {
    return null;
  }
}

/**
 * Get a price quote from the LENS contract.
 * Returns [routerAddress, amountOut] or null on failure.
 */
export async function getQuote(
  tokenAddress: Address,
  amountIn: bigint,
  isBuy: boolean
): Promise<{ router: Address; amountOut: bigint } | null> {
  try {
    const result = await publicClient.readContract({
      address: LENS,
      abi: lensAbi,
      functionName: "getAmountOut",
      args: [tokenAddress, amountIn, isBuy],
    });
    return { router: result[0], amountOut: result[1] };
  } catch {
    return null;
  }
}

/**
 * Get basic ERC-20 token metadata via multicall.
 * Useful as fallback if nad.fun API is down.
 */
export async function getErc20Metadata(tokenAddress: Address) {
  try {
    const results = await publicClient.multicall({
      contracts: [
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "name",
        },
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "symbol",
        },
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals",
        },
        {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "totalSupply",
        },
      ],
    });

    return {
      name:
        results[0].status === "success"
          ? (results[0].result as string)
          : "Unknown",
      symbol:
        results[1].status === "success"
          ? (results[1].result as string)
          : "UNKNOWN",
      decimals:
        results[2].status === "success"
          ? (results[2].result as number)
          : 18,
      totalSupply:
        results[3].status === "success"
          ? (results[3].result as bigint)
          : 0n,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch event logs in parallel chunks of CHUNK_SIZE blocks.
 * Silently skips failed chunks.
 */
async function chunkedEventScan(
  eventName: "CurveCreate" | "CurveBuy" | "CurveSell" | "CurveGraduate" | "CurveSync",
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize = 5000n,
  concurrency = 3,
) {
  const chunks: { from: bigint; to: bigint }[] = [];
  for (let start = fromBlock; start < toBlock; start += chunkSize) {
    const end = start + chunkSize > toBlock ? toBlock : start + chunkSize;
    chunks.push({ from: start, to: end });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLogs: any[] = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((c) =>
        eventClient.getContractEvents({
          address: CURVE,
          abi: curveAbi,
          eventName,
          fromBlock: c.from,
          toBlock: c.to,
        }),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled") allLogs.push(...r.value);
    }
  }
  return allLogs;
}

/**
 * Get recent CurveCreate events from the bonding curve contract.
 * Uses chunked parallel scanning to cover large block ranges without exceeding RPC limits.
 */
export async function getRecentCreations(blockRange = 5000n) {
  try {
    const latestBlock = await eventClient.getBlockNumber();
    const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : 0n;

    const allLogs = await chunkedEventScan("CurveCreate", fromBlock, latestBlock);

    return allLogs.reverse().map((log: { args: { creator: string; token: string; name: string; symbol: string }; blockNumber: bigint }) => ({
      creator: log.args.creator,
      token: log.args.token,
      name: log.args.name,
      symbol: log.args.symbol,
      blockNumber: log.blockNumber,
    }));
  } catch {
    return [];
  }
}

/**
 * Get graduated tokens by scanning CurveGraduate events.
 * Graduated tokens trade on DEX (not bonding curve) and typically have the most holders.
 * Returns unique token addresses.
 */
export async function getGraduatedTokens(blockRange = 5000n) {
  try {
    const latestBlock = await eventClient.getBlockNumber();
    const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : 0n;

    const allLogs = await chunkedEventScan("CurveGraduate", fromBlock, latestBlock);

    return allLogs.map((log: { args: { token: string; pool: string }; blockNumber: bigint }) => ({
      address: log.args.token,
      pool: log.args.pool,
      blockNumber: log.blockNumber,
    }));
  } catch {
    return [];
  }
}

/**
 * Discover actively traded DEX tokens using the rate-limit-free /events endpoint.
 * This is MUCH faster than on-chain event scanning (~1-2s vs 30+s).
 *
 * Flow:
 * 1. GET /events (rate-limit-free) → active DEX pair addresses + priceNative
 * 2. readContract token0/token1 on each pool → token addresses
 * 3. readContract name/symbol on each token → metadata
 *
 * Returns graduated tokens sorted by trade count, with priceNative from events.
 */
export async function getActiveDexTokens(): Promise<
  { address: string; name: string; symbol: string; trades: number; priceNative: number }[]
> {
  try {
    // 1. Fetch latest block from rate-limit-free endpoint
    const lbRes = await fetch(`${NAD_API_BASE}/latest-block`, { cache: "no-store" });
    const lbData = await lbRes.json() as { block: { blockNumber: number } };
    const latest = lbData.block.blockNumber;

    // 2. Fetch recent events (10k block max per docs) — rate-limit-free
    const from = latest - 10000;
    const evRes = await fetch(
      `${NAD_API_BASE}/events?fromBlock=${from}&toBlock=${latest}`,
      { cache: "no-store" },
    );
    const evData = await evRes.json() as {
      events: Array<{ pairId: string; eventType: string; priceNative?: string }>;
    };
    const events = evData.events || [];

    // 3. Count trades per DEX pair (exclude bonding curve) + capture latest price
    const pairCounts = new Map<string, number>();
    const pairLatestPrice = new Map<string, number>();
    for (const e of events) {
      if (e.pairId === CURVE) continue; // bonding curve, not DEX
      pairCounts.set(e.pairId, (pairCounts.get(e.pairId) || 0) + 1);
      // Keep the latest price for each pair (events are in order)
      if (e.priceNative) {
        pairLatestPrice.set(e.pairId, Number(e.priceNative));
      }
    }

    if (pairCounts.size === 0) return [];

    // 4. Read token0/token1 from each pool contract in parallel
    const pairEntries = [...pairCounts.entries()].sort((a, b) => b[1] - a[1]);
    const tokenReads = await Promise.allSettled(
      pairEntries.flatMap(([poolAddr]) => [
        publicClient.readContract({
          address: poolAddr as Address,
          abi: poolAbi,
          functionName: "token0",
        }),
        publicClient.readContract({
          address: poolAddr as Address,
          abi: poolAbi,
          functionName: "token1",
        }),
      ]),
    );

    // 5. Extract token addresses (filter out WMON) + map price
    const tokenMap = new Map<string, number>(); // address -> trades
    const tokenPrice = new Map<string, number>(); // address -> priceNative (tokens per MON)
    for (let i = 0; i < pairEntries.length; i++) {
      const t0Res = tokenReads[i * 2];
      const t1Res = tokenReads[i * 2 + 1];
      if (t0Res.status !== "fulfilled" || t1Res.status !== "fulfilled") continue;
      const t0 = t0Res.value as string;
      const t1 = t1Res.value as string;
      const isToken0Wmon = t0.toLowerCase() === WMON.toLowerCase();
      const token = isToken0Wmon ? t1 : t0;
      const trades = pairEntries[i][1];
      const poolAddr = pairEntries[i][0];
      tokenMap.set(token, (tokenMap.get(token) || 0) + trades);
      // priceNative from events = tokens per MON (or MON per token depending on pair order)
      const rawPrice = pairLatestPrice.get(poolAddr);
      if (rawPrice) tokenPrice.set(token, rawPrice);
    }

    if (tokenMap.size === 0) return [];

    // 6. Read name/symbol for each token in parallel
    const tokenAddrs = [...tokenMap.keys()];
    const metaReads = await Promise.allSettled(
      tokenAddrs.flatMap((addr) => [
        publicClient.readContract({ address: addr as Address, abi: erc20Abi, functionName: "name" }),
        publicClient.readContract({ address: addr as Address, abi: erc20Abi, functionName: "symbol" }),
      ]),
    );

    return tokenAddrs
      .map((addr, i) => {
        const nameRes = metaReads[i * 2];
        const symRes = metaReads[i * 2 + 1];
        return {
          address: addr,
          name: nameRes.status === "fulfilled" ? String(nameRes.value) : `Token ${addr.slice(0, 8)}`,
          symbol: symRes.status === "fulfilled" ? String(symRes.value) : addr.slice(2, 6).toUpperCase(),
          trades: tokenMap.get(addr) || 0,
          priceNative: tokenPrice.get(addr) || 0,
        };
      })
      .sort((a, b) => b.trades - a.trades);
  } catch {
    return [];
  }
}

/**
 * Get actively traded tokens by scanning CurveBuy events.
 * Uses chunked parallel scanning to cover large block ranges without exceeding RPC limits.
 * Returns unique token addresses sorted by trade count (most traded first).
 */
export async function getActivelyTradedTokens(blockRange = 5000n) {
  try {
    const latestBlock = await eventClient.getBlockNumber();
    const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : 0n;

    const allLogs = await chunkedEventScan("CurveBuy", fromBlock, latestBlock);

    // Count trades per token
    const tradeCounts = new Map<string, number>();
    for (const log of allLogs) {
      const token = (log as { args: { token: string } }).args.token;
      tradeCounts.set(token, (tradeCounts.get(token) || 0) + 1);
    }

    // Sort by trade count descending
    return Array.from(tradeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([address, trades]) => ({ address, trades }));
  } catch {
    return [];
  }
}
