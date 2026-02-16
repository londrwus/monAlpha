# TOKEN Skill - ERC-20 Operations

Low-level token operations with viem for ERC-20 and ERC-2612 permit support.

> **Setup**: See `skill.md` for network config and client setup. ABIs in `ABI.md`.

## 1. Get Balance

```typescript
const balance = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [ownerAddress],
})
```

## 2. Get Metadata (Multicall)

```typescript
const results = await publicClient.multicall({
  contracts: [
    { address: tokenAddress, abi: erc20Abi, functionName: "name" as const },
    { address: tokenAddress, abi: erc20Abi, functionName: "symbol" as const },
    { address: tokenAddress, abi: erc20Abi, functionName: "decimals" as const },
    { address: tokenAddress, abi: erc20Abi, functionName: "totalSupply" as const },
  ],
})

const metadata = {
  name: results[0].status === "success" ? results[0].result : "Unknown",
  symbol: results[1].status === "success" ? results[1].result : "UNKNOWN",
  decimals: results[2].status === "success" ? results[2].result : 18,
  totalSupply: results[3].status === "success" ? results[3].result : 0n,
}
```

## 3. Get Allowance

```typescript
const allowance = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "allowance",
  args: [ownerAddress, spenderAddress],
})
```

## 4. Approve

```typescript
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "approve",
  args: [spenderAddress, amount],
  account,
  chain,
})
await publicClient.waitForTransactionReceipt({ hash })
```

## 5. Transfer

```typescript
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "transfer",
  args: [toAddress, amount],
  account,
  chain,
})
await publicClient.waitForTransactionReceipt({ hash })
```

## 6. Generate Permit Signature (ERC-2612)

```typescript
// Get nonce
const nonce = await publicClient.readContract({
  address: tokenAddress,
  abi: [
    {
      name: "nonces",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ type: "uint256" }],
    },
  ],
  functionName: "nonces",
  args: [ownerAddress],
})

// Get token name
const tokenName = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "name",
})

// Sign permit
const signature = await walletClient.signTypedData({
  account,
  domain: { name: tokenName, version: "1", chainId: chain.id, verifyingContract: tokenAddress },
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: { owner: ownerAddress, spender, value, nonce, deadline },
})

// Parse v, r, s
const r = `0x${signature.slice(2, 66)}` as `0x${string}`
const s = `0x${signature.slice(66, 130)}` as `0x${string}`
const v = parseInt(signature.slice(130, 132), 16) as 27 | 28

return { v, r, s, nonce }
```

## Batch Operations

```typescript
// Get multiple balances in one call
const results = await publicClient.multicall({
  contracts: [
    { address: token1, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] },
    { address: token2, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] },
    { address: token3, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] },
  ],
})
const balances = results.map((r) => (r.status === "success" ? r.result : 0n))
```

## Key Points

- **All amounts in raw bigint** - multiply/divide by `10**decimals` for display
- **Always check allowance before approve** - some tokens require reset to 0 first
- **Permit requires ERC-2612** - verify token has `nonces` function
- **Nonce must be fresh** - fetch immediately before signing
- **Deadline in seconds** - Unix timestamp, typically `Date.now()/1000 + 300`
- **All NadFun tokens use 18 decimals**

## Type Definitions

```typescript
interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
}

interface PermitSignature {
  v: 27 | 28
  r: `0x${string}`
  s: `0x${string}`
  nonce: bigint
}
```
