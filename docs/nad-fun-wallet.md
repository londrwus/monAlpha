# WALLET Skill - Key & Address Generation

Wallet generation using viem.

## Generate New Wallet

```typescript
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const privateKey = generatePrivateKey() // '0x...' (64 hex chars)
const account = privateKeyToAccount(privateKey)

// account.address - wallet address
// account.publicKey - public key
```

## Import Existing Key

```typescript
import { privateKeyToAccount } from "viem/accounts"

const account = privateKeyToAccount("0x..." as `0x${string}`)
```

## Create Wallet Client

```typescript
import { createWalletClient, http } from "viem"

const walletClient = createWalletClient({
  account,
  chain, // from skill.md setup
  transport: http(CONFIG.rpcUrl),
})
```

## Type Reference

```typescript
import type { PrivateKeyAccount, Address, Hex } from 'viem'

type PrivateKey = `0x${string}` // 0x + 64 hex

// Account properties
account.address    // Address
account.publicKey  // Hex
account.source     // 'privateKey'
account.type       // 'local'

// Signing methods
account.signMessage({ message: 'Hello' })
account.signTransaction({ ... })
account.signTypedData({ ... })
```

## Security

- **Never hardcode** private keys
- Use environment variables: `process.env.PRIVATE_KEY as \`0x\${string}\``
- Don't log private keys in production
