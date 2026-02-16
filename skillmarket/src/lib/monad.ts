import { createPublicClient, http, defineChain } from "viem";
import { CONFIG, MONAD_RPC_URL } from "./constants";

/** RPC for event scanning — use QuickNode (same as primary) for reliability */
const EVENT_SCAN_RPC = MONAD_RPC_URL;

export const monadChain = defineChain({
  id: CONFIG.chainId,
  name: CONFIG.chainId === 10143 ? "Monad Testnet" : "Monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MONAD_RPC_URL],
    },
  },
  testnet: CONFIG.chainId === 10143,
});

/** Primary client — uses QuickNode for fast contract reads */
export const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(MONAD_RPC_URL),
});

/** Secondary client — uses public RPC for eth_getLogs (larger block ranges) */
export const eventClient = createPublicClient({
  chain: monadChain,
  transport: http(EVENT_SCAN_RPC),
});
