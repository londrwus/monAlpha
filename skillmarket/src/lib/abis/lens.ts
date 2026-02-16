export const lensAbi = [
  {
    name: "getAmountOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "isBuy", type: "bool" },
    ],
    outputs: [
      { name: "router", type: "address" },
      { name: "amountOut", type: "uint256" },
    ],
  },
  {
    name: "getAmountIn",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "amountOut", type: "uint256" },
      { name: "isBuy", type: "bool" },
    ],
    outputs: [
      { name: "router", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
  },
  {
    name: "getProgress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenAddress", type: "address" }],
    outputs: [{ name: "progress", type: "uint256" }],
  },
  {
    name: "getInitialBuyAmountOut",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;
