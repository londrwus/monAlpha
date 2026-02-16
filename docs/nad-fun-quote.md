# QUOTE Skill - Price Quotes and Curve State

Pure viem implementation for querying bonding curve prices and state. Supports testnet and mainnet.

> **Setup**: See `skill.md` for network config and client setup. ABIs in `ABI.md`.

## 1. getAmountOut

Get expected output amount for buy/sell.

- `isBuy = true`: Buying tokens with MON
- `isBuy = false`: Selling tokens for MON

**Returns**: `[router, amountOut]` - Router address and expected output in wei.

```typescript
const [router, amountOut] = await publicClient.readContract({
  address: CONFIG.LENS,
  abi: lensAbi,
  functionName: "getAmountOut",
  args: [tokenAddress, amountIn, isBuy],
})
```

## 2. getAmountIn

Get required input for desired output (inverse of getAmountOut).

```typescript
const [router, amountIn] = await publicClient.readContract({
  address: CONFIG.LENS,
  abi: lensAbi,
  functionName: "getAmountIn",
  args: [tokenAddress, amountOut, isBuy],
})
```

## 3. getCurveState

Get complete bonding curve state.

**Returns**:

- `realMonReserve` / `realTokenReserve`: Actual reserves
- `virtualMonReserve` / `virtualTokenReserve`: Virtual reserves for pricing
- `k`: Constant product (x \* y = k)
- `targetTokenAmount`: Tokens needed to graduate
- `initVirtualMonReserve` / `initVirtualTokenReserve`: Initial values

```typescript
const [
  realMonReserve,
  realTokenReserve,
  virtualMonReserve,
  virtualTokenReserve,
  k,
  targetTokenAmount,
  initVirtualMonReserve,
  initVirtualTokenReserve,
] = await publicClient.readContract({
  address: CONFIG.CURVE,
  abi: curveAbi,
  functionName: "curves",
  args: [tokenAddress],
})
```

## 4. getProgress

Get graduation progress (0-10000 = 0-100%).

```typescript
const progress = await publicClient.readContract({
  address: CONFIG.LENS,
  abi: lensAbi,
  functionName: "getProgress",
  args: [tokenAddress],
})

const percentage = Number(progress) / 100 // e.g., 5000 -> 50%
```

## 5. isGraduated

Check if token moved from bonding curve to DEX.

```typescript
const graduated = await publicClient.readContract({
  address: CONFIG.CURVE,
  abi: curveAbi,
  functionName: "isGraduated",
  args: [tokenAddress],
})
```

## 6. isLocked

Check if bonding curve is locked (cannot trade).

```typescript
const locked = await publicClient.readContract({
  address: CONFIG.CURVE,
  abi: curveAbi,
  functionName: "isLocked",
  args: [tokenAddress],
})
```

## Common Patterns

### Check if token can be bought

```typescript
const [graduated, locked] = await Promise.all([
  publicClient.readContract({
    address: CONFIG.CURVE,
    abi: curveAbi,
    functionName: "isGraduated",
    args: [tokenAddress],
  }),
  publicClient.readContract({
    address: CONFIG.CURVE,
    abi: curveAbi,
    functionName: "isLocked",
    args: [tokenAddress],
  }),
])
const canBuy = !graduated && !locked
```

### Calculate price per token

```typescript
const [, tokenAmount] = await publicClient.readContract({
  address: CONFIG.LENS,
  abi: lensAbi,
  functionName: "getAmountOut",
  args: [tokenAddress, parseEther("0.1"), true],
})
const pricePerToken = parseEther("0.1") / tokenAmount
```

## Network Details

| Network | Chain ID | LENS                                       | CURVE                                      |
| ------- | -------- | ------------------------------------------ | ------------------------------------------ |
| Testnet | 10143    | 0xB056d79CA5257589692699a46623F901a3BB76f1 | 0x1228b0dc9481C11D3071E7A924B794CfB038994e |
| Mainnet | 143      | 0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea | 0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE |
