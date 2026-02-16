# AUSD Skill - Swap & Yield

Get aUSD via LiFi swap, then deposit to Upshift Finance vault for yield.

> **Setup**: See `skill.md` for network config and client setup.

## Contract Addresses (Mainnet Only)

| Contract    | Address                                    | Description            |
| ----------- | ------------------------------------------ | ---------------------- |
| LiFi Router | 0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37 | LiFi Diamond Proxy     |
| aUSD        | 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a | Agora USD (6 decimals) |
| Vault       | 0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA | Upshift aUSD Vault     |
| earnAUSD    | Query via `lpTokenAddress()`               | LP token               |

---

## Part 1: LiFi Swap (MON → aUSD)

### API Endpoint

```
GET https://li.quest/v1/quote
```

### Parameters

| Parameter   | Value                                        | Description                          |
| ----------- | -------------------------------------------- | ------------------------------------ |
| fromChain   | `143`                                        | Monad chain ID                       |
| toChain     | `143`                                        | Same-chain swap                      |
| fromToken   | `0x0000000000000000000000000000000000000000` | Native MON                           |
| toToken     | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | aUSD                                 |
| fromAmount  | Amount in wei                                | e.g., `100000000000000000` = 0.1 MON |
| fromAddress | Sender address                               |                                      |
| toAddress   | Receiver address                             | Usually same as fromAddress          |
| slippage    | `0.03`                                       | 3% slippage                          |
| integrator  | `NadFun`                                     | Referral ID                          |
| fee         | `0.01`                                       |                                      |

**Note**: Both `integrator` AND `fee` required for referral revenue.

### Get Quote

```typescript
const LIFI_API = "https://li.quest/v1"

interface LiFiQuote {
  estimate: { toAmount: string; toAmountMin: string }
  transactionRequest: { to: string; data: string; value: string; gasLimit: string }
}

async function getLiFiQuote(fromAddress: string, amountWei: bigint): Promise<LiFiQuote> {
  const params = new URLSearchParams({
    fromChain: "143",
    toChain: "143",
    fromToken: "0x0000000000000000000000000000000000000000",
    toToken: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    fromAmount: amountWei.toString(),
    fromAddress,
    toAddress: fromAddress,
    slippage: "0.03",
    integrator: "NadFun",
    fee: "0.01",
  })
  const res = await fetch(`${LIFI_API}/quote?${params}`)
  if (!res.ok) throw new Error(`LiFi API error: ${res.status}`)
  return res.json()
}
```

### Execute Swap

```typescript
const swapAmount = parseEther("0.1") // 0.1 MON

// 1. Get quote
const quote = await getLiFiQuote(account.address, swapAmount)

// 2. Send transaction (use quote's transactionRequest directly)
const txHash = await walletClient.sendTransaction({
  to: quote.transactionRequest.to as Address,
  data: quote.transactionRequest.data as `0x${string}`,
  value: BigInt(quote.transactionRequest.value),
  gas: BigInt(quote.transactionRequest.gasLimit),
})

await publicClient.waitForTransactionReceipt({ hash: txHash })
```

---

## Part 2: Upshift Vault (aUSD → earnAUSD)

### Vault ABI

```typescript
const vaultAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "receiverAddr", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "assetIn", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    name: "instantRedeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiverAddr", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "requestRedeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiverAddr", type: "address" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "year", type: "uint256" },
      { name: "month", type: "uint256" },
      { name: "day", type: "uint256" },
      { name: "receiverAddr", type: "address" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    name: "previewRedemption",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "isInstant", type: "bool" },
    ],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    name: "lpTokenAddress",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "depositsPaused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "maxDepositAmount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getTotalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getSharePrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const
```

### Check Vault Info

```typescript
const [depositsPaused, maxDeposit, totalAssets, sharePrice, lpToken] = await Promise.all([
  publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "depositsPaused" }),
  publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "maxDepositAmount" }),
  publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "getTotalAssets" }),
  publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "getSharePrice" }),
  publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "lpTokenAddress" }),
])
```

### Deposit aUSD

```typescript
import { erc20Abi } from "viem"

const depositAmount = parseUnits("100", 6) // 6 decimals!

// 1. Check vault status
const depositsPaused = await publicClient.readContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "depositsPaused",
})
if (depositsPaused) throw new Error("Deposits paused")

// 2. Preview expected shares
const [expectedShares] = await publicClient.readContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "previewDeposit",
  args: [AUSD, depositAmount],
})

// 3. Approve if needed
const allowance = await publicClient.readContract({
  address: AUSD,
  abi: erc20Abi,
  functionName: "allowance",
  args: [account.address, VAULT],
})
if (allowance < depositAmount) {
  const approveTx = await walletClient.writeContract({
    address: AUSD,
    abi: erc20Abi,
    functionName: "approve",
    args: [VAULT, depositAmount],
    account,
    chain,
  })
  await publicClient.waitForTransactionReceipt({ hash: approveTx })
}

// 4. Deposit
const depositTx = await walletClient.writeContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "deposit",
  args: [AUSD, depositAmount, account.address],
  account,
  chain,
})
await publicClient.waitForTransactionReceipt({ hash: depositTx })
```

### Redeem Options

| Method         | Fee      | Wait Time | Use When               |
| -------------- | -------- | --------- | ---------------------- |
| Instant Redeem | **0.2%** | None      | Need funds immediately |
| Request Redeem | **None** | ~3 days   | Save on fees           |

> **IMPORTANT: Ask User Before Redeem**
>
> Before executing any redeem, you MUST ask the user which option they prefer:
>
> 1. **Instant Redeem** - Get aUSD immediately, but pay **0.2% fee**
> 2. **Request Redeem** - No fee, but must wait **~3 days** to claim
>
> Example prompt:
> "You're about to redeem X earnAUSD. Which option do you prefer?
>
> - **Instant**: Receive ~Y aUSD now (0.2% fee deducted)
> - **Wait 3 days**: Receive ~Z aUSD with no fee
>
> Which would you like?"

### Instant Redeem (with fee)

```typescript
import { erc20Abi } from "viem"

const shares = parseUnits("100", 6)

// 1. Preview redemption (with fee)
const [assetsBeforeFee, assetsAfterFee] = await publicClient.readContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "previewRedemption",
  args: [shares, true], // true = instant
})

<<<<<<< HEAD
// 2. Redeem
=======
// 2. Redeem (no approve needed)
>>>>>>> a7e1213b ([chore] skill update)
const redeemTx = await walletClient.writeContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "instantRedeem",
  args: [shares, account.address],
  account,
  chain,
})
await publicClient.waitForTransactionReceipt({ hash: redeemTx })
```

# <<<<<<< HEAD

### Request Redeem + Claim (no fee)

```typescript
import { erc20Abi } from "viem"

const shares = parseUnits("100", 6)

// 1. Get LP token address
const lpToken = await publicClient.readContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "lpTokenAddress",
})

// 2. Approve LP token (required for requestRedeem)
const approveTx = await walletClient.writeContract({
  address: lpToken,
  abi: erc20Abi,
  functionName: "approve",
  args: [VAULT, shares],
  account,
  chain,
})
await publicClient.waitForTransactionReceipt({ hash: approveTx })

// 3. Request redeem - returns claimable date
const requestTx = await walletClient.writeContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "requestRedeem",
  args: [shares, account.address],
  account,
  chain,
})
// Returns: [claimableEpoch, year, month, day]

// 4. Wait ~3 days, then claim
const claimTx = await walletClient.writeContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "claim",
  args: [2025n, 2n, 10n, account.address], // year, month, day from requestRedeem
  account,
  chain,
})
await publicClient.waitForTransactionReceipt({ hash: claimTx })
```

> > > > > > > a7e1213b ([chore] skill update)

---

## Key Points

| Topic             | Note                                                 |
| ----------------- | ---------------------------------------------------- |
| **Decimals**      | MON = 18, aUSD = 6, earnAUSD = 6                     |
| **LiFi referral** | Both `integrator` + `fee` required for revenue       |
| **Quote expiry**  | LiFi calldata expires quickly, fetch fresh before tx |
| **Vault status**  | Always check `depositsPaused` before deposit         |

<<<<<<< HEAD
| **Instant redeem** | Has fee, check `previewRedemption` first |
=======
| **Instant redeem** | 0.2% fee, no approve needed |
| **Request redeem** | No fee, LP token approve required, ~3 day wait |

> > > > > > > a7e1213b ([chore] skill update)
