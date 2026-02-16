export const curveAbi = [
  {
    name: "curves",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenAddress", type: "address" }],
    outputs: [
      { name: "realMonReserve", type: "uint256" },
      { name: "realTokenReserve", type: "uint256" },
      { name: "virtualMonReserve", type: "uint256" },
      { name: "virtualTokenReserve", type: "uint256" },
      { name: "k", type: "uint256" },
      { name: "targetTokenAmount", type: "uint256" },
      { name: "initVirtualMonReserve", type: "uint256" },
      { name: "initVirtualTokenReserve", type: "uint256" },
    ],
  },
  {
    name: "isGraduated",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenAddress", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isLocked",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenAddress", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "feeConfig",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "deployFeeAmount", type: "uint256" },
      { name: "deployFeeRate", type: "uint256" },
      { name: "tradeFeeRate", type: "uint256" },
    ],
  },
  // Events
  {
    name: "CurveCreate",
    type: "event",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "tokenURI", type: "string", indexed: false },
      { name: "virtualMon", type: "uint256", indexed: false },
      { name: "virtualToken", type: "uint256", indexed: false },
      { name: "targetTokenAmount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CurveBuy",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CurveSell",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CurveGraduate",
    type: "event",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: false },
    ],
  },
  {
    name: "CurveSync",
    type: "event",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "realMonReserve", type: "uint256", indexed: false },
      { name: "realTokenReserve", type: "uint256", indexed: false },
      { name: "virtualMonReserve", type: "uint256", indexed: false },
      { name: "virtualTokenReserve", type: "uint256", indexed: false },
    ],
  },
] as const;
