# INDEXER Skill - Historical Event Querying

Query past bonding curve trades and DEX swaps using viem's RPC-based indexing.

> **Setup**: See `skill.md` for network config and client setup. ABIs in `ABI.md`.

## Network Config

| Network | CURVE                                      | V3_FACTORY                                 | WMON                                       |
| ------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| Testnet | 0x1228b0dc9481C11D3071E7A924B794CfB038994e | 0xd0a37cf728CE2902eB8d4F6f2afc76854048253b | 0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd |
| Mainnet | 0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE | 0x6B5F564339DbAD6b780249827f2198a841FEB7F3 | 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A |

## Basic Query

```typescript
const logs = await publicClient.getContractEvents({
  address: CURVE_ADDRESS,
  abi: curveAbi,
  eventName: "CurveBuy",
  fromBlock: 1000000n,
  toBlock: 1001000n,
  args: { token: tokenAddress }, // optional filter
})
```

## Curve Event Types

### CurveCreate

```typescript
{
  ;(creator, token, pool, name, symbol, tokenURI, virtualMon, virtualToken, targetTokenAmount)
}
```

### CurveBuy / CurveSell

```typescript
{
  ;(sender, token, amountIn, amountOut)
}
```

### CurveSync

```typescript
{
  ;(token, realMonReserve, realTokenReserve, virtualMonReserve, virtualTokenReserve)
}
```

### CurveTokenLocked

```typescript
{
  token
}
```

### CurveGraduate

```typescript
{
  ;(token, pool)
}
```

## Query Examples

```typescript
// All creates
const creates = await publicClient.getContractEvents({
  address: CURVE_ADDRESS,
  abi: curveAbi,
  eventName: "CurveCreate",
  fromBlock,
  toBlock,
})

// Buys for specific token
const buys = await publicClient.getContractEvents({
  address: CURVE_ADDRESS,
  abi: curveAbi,
  eventName: "CurveBuy",
  fromBlock,
  toBlock,
  args: { token: tokenAddress },
})

// Sells for specific token
const sells = await publicClient.getContractEvents({
  address: CURVE_ADDRESS,
  abi: curveAbi,
  eventName: "CurveSell",
  fromBlock,
  toBlock,
  args: { token: tokenAddress },
})

// Graduations
const graduates = await publicClient.getContractEvents({
  address: CURVE_ADDRESS,
  abi: curveAbi,
  eventName: "CurveGraduate",
  fromBlock,
  toBlock,
})
```

## DEX (Uniswap V3) Events

### Discover Pool

```typescript
const pool = await publicClient.readContract({
  address: V3_FACTORY,
  abi: uniswapV3FactoryAbi,
  functionName: "getPool",
  args: [tokenAddress, WMON_ADDRESS, 3000], // fee: 500, 3000, or 10000
})
```

### Query Swaps

```typescript
const swaps = await publicClient.getContractEvents({
  address: poolAddress,
  abi: uniswapV3PoolAbi,
  eventName: "Swap",
  fromBlock,
  toBlock,
})
// { sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick }
```

### Get Pool Info

```typescript
const [token0, token1, fee, liquidity, slot0] = await Promise.all([
  publicClient.readContract({
    address: poolAddress,
    abi: uniswapV3PoolAbi,
    functionName: "token0",
  }),
  publicClient.readContract({
    address: poolAddress,
    abi: uniswapV3PoolAbi,
    functionName: "token1",
  }),
  publicClient.readContract({ address: poolAddress, abi: uniswapV3PoolAbi, functionName: "fee" }),
  publicClient.readContract({
    address: poolAddress,
    abi: uniswapV3PoolAbi,
    functionName: "liquidity",
  }),
  publicClient.readContract({ address: poolAddress, abi: uniswapV3PoolAbi, functionName: "slot0" }),
])
// slot0: [sqrtPriceX96, tick, observationIndex, ...]
```

## Block Range Tips

```typescript
// Get latest block
const latest = await publicClient.getBlockNumber()

// Safe lag (avoid reorgs)
const safeToBlock = latest - 10n

// Last hour (~1 block/sec on Monad)
const oneHourAgo = latest - 3600n

// Paginate large ranges
const CHUNK = 10000n
for (let from = start; from < end; from += CHUNK) {
  const to = from + CHUNK > end ? end : from + CHUNK
  const events = await publicClient.getContractEvents({ ... fromBlock: from, toBlock: to })
  allEvents.push(...events)
}
```

## Common Use Cases

| Task                         | Event               | Filter                              |
| ---------------------------- | ------------------- | ----------------------------------- |
| All trades on token X        | CurveBuy, CurveSell | `args: { token }`                   |
| When did token graduate      | CurveGraduate       | `args: { token }`                   |
| Buy volume for token         | CurveBuy            | Sum `amountIn`                      |
| Whale buys (>1 MON)          | CurveBuy            | Filter `amountIn > parseEther('1')` |
| DEX activity post-graduation | Swap                | Query pool address                  |
| Recent token creations       | CurveCreate         | Last N blocks                       |
