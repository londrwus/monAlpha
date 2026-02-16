# Agent API Skill - REST API

REST API for AI agents and external services.

## Rate Limits

| Request Source                                | API Key      | Rate Limit              |
| --------------------------------------------- | ------------ | ----------------------- |
| nad.fun, nadapp.net, _.nad.fun, _.symphony.io | Not required | None                    |
| localhost:\*                                  | Not required | None                    |
| External origin (no API Key)                  | Optional     | 10 req/min (IP-based)   |
| External origin (with API Key)                | Optional     | 100 req/min (Key-based) |

**Excluded paths** (no API Key check): `/health`, `/`, `/cms/*`, `/dev-sw*`, `/api-key/*`, `/auth/*`, `/latest-block`, `/asset`, `/pair`, `/events`

## Setup

```typescript
const NETWORK = "mainnet" // 'testnet' | 'mainnet'
const API_URL = NETWORK === "mainnet" ? "https://api.nadapp.net" : "https://dev-api.nad.fun"
const headers = { "X-API-Key": "nadfun_xxx" } // optional but recommended
```

## Endpoints

| Endpoint                           | Method          | Description                           |
| ---------------------------------- | --------------- | ------------------------------------- |
| `/agent/chart/:token_id`           | GET             | OHLCV chart data                      |
| `/agent/swap-history/:token_id`    | GET             | Transaction history                   |
| `/agent/market/:token_id`          | GET             | Current market data                   |
| `/agent/metrics/:token_id`         | GET             | Trading metrics                       |
| `/agent/token/:token_id`           | GET             | Token information                     |
| `/agent/holdings/:account_id`      | GET             | User holdings                         |
| `/agent/token/image`               | POST            | Upload image                          |
| `/agent/token/metadata`            | POST            | Upload metadata                       |
| `/agent/token/created/:account_id` | GET             | Created tokens list                   |
| `/agent/salt`                      | POST            | Mine salt for token address           |
| `/api-key`                         | POST/GET/DELETE | API key management (session required) |

## 1. Chart Data

```typescript
const url = `${API_URL}/agent/chart/${tokenId}?resolution=60&from=${fromTs}&to=${toTs}`
const { t, o, h, l, c, v, s } = await fetch(url, { headers }).then((r) => r.json())
// t: timestamps, o/h/l/c: prices, v: volume, s: status
```

**Params**: `resolution` (1/5/15/30/60/240/1D), `from`, `to`, `countback?`, `chart_type?`

## 2. Swap History

```typescript
const url = `${API_URL}/agent/swap-history/${tokenId}?limit=20&trade_type=BUY`
const { swaps, total_count } = await fetch(url, { headers }).then((r) => r.json())
// swaps[].swap_info: { event_type, native_amount, token_amount, transaction_hash, ... }
```

**Params**: `page?`, `limit?`, `direction?`, `trade_type?` (BUY/SELL/ALL), `volume_ranges?`, `account_id?`

## 3. Market Data

```typescript
const { market_info } = await fetch(`${API_URL}/agent/market/${tokenId}`, { headers }).then((r) =>
  r.json(),
)
// { market_type, price_usd, holder_count, volume, ath_price, ... }
```

## 4. Metrics

```typescript
const url = `${API_URL}/agent/metrics/${tokenId}?timeframes=1,5,60,1D`
const { metrics } = await fetch(url, { headers }).then((r) => r.json())
// metrics[]: { timeframe, percent, transactions, volume, makers }
```

## 5. Token Info

```typescript
const { token_info } = await fetch(`${API_URL}/agent/token/${tokenId}`, { headers }).then((r) =>
  r.json(),
)
// { name, symbol, image_uri, description, is_graduated, creator, ... }
```

## 6. Holdings

```typescript
const url = `${API_URL}/agent/holdings/${accountId}?page=1&limit=20`
const { tokens, total_count } = await fetch(url, { headers }).then((r) => r.json())
// tokens[]: { token_info, balance_info, market_info }
```

## 7. Upload Image

```typescript
const { image_uri, is_nsfw } = await fetch(`${API_URL}/agent/token/image`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "image/png" },
  body: imageBuffer,
}).then((r) => r.json())
```

**Max 5MB**, formats: PNG, JPG, GIF, WEBP, SVG

## 8. Upload Metadata

```typescript
const { metadata_uri } = await fetch(`${API_URL}/agent/token/metadata`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ image_uri, name, symbol, description, website?, twitter?, telegram? }),
}).then(r => r.json())
```

## 9. Created Tokens

```typescript
const url = `${API_URL}/agent/token/created/${accountId}?page=1&limit=10`
const { tokens, total_count } = await fetch(url, { headers }).then((r) => r.json())
// tokens[]: { token_info, market_info, balance_info, reward_info }
```

## 10. Mine Salt

```typescript
const { salt, address } = await fetch(`${API_URL}/agent/salt`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ creator, name, symbol, metadata_uri }),
}).then((r) => r.json())
```

## API Key Management

Requires session cookie (login to nad.fun first). **Max 5 keys per account.**

Cookie name: `nadfun-v3-api`

**IMPORTANT**: The full `api_key` is only shown ONCE when you create it. If you lose it:
1. Use List to find the key's `id` by `key_prefix` or `name`
2. Delete the old key by `id`
3. Create a new key

The List endpoint only returns `key_prefix` (e.g., `nadfun_abc...`), not the full key.

```typescript
// Create (api_key returned ONLY ONCE!)
const { id, api_key, key_prefix, name } = await fetch(`${API_URL}/api-key`, {
  method: 'POST',
  headers: { Cookie: 'nadfun-v3-api=<token>', 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'My Bot', description?: string, expires_in_days?: 365 }),
}).then(r => r.json())
// ⚠️ SAVE api_key NOW! You cannot retrieve it again.

// List (does NOT return full api_key, only key_prefix)
const { api_keys, total } = await fetch(`${API_URL}/api-key`, {
  headers: { Cookie: 'nadfun-v3-api=<token>' },
}).then(r => r.json())
// api_keys[]: { id, key_prefix, name, description, owner_address, is_active, created_at, expires_at, last_used_at, request_count }
// Use this to find the ID of a lost key for deletion

// Delete (cannot be undone)
await fetch(`${API_URL}/api-key/${id}`, {
  method: 'DELETE',
  headers: { Cookie: 'nadfun-v3-api=<token>' },
})
// If you forgot your api_key, delete and create a new one
```

## Rate Limit Headers

```
X-RateLimit-Limit: 10 or 100
X-RateLimit-Remaining: N
X-RateLimit-Window: 1m
X-RateLimit-Upgrade: (only when no API Key - suggests using one)
```

## TypeScript Types

```typescript
interface CreateApiKeyRequest {
  name: string
  description?: string
  expires_in_days?: number // null = never expires
}

interface CreateApiKeyResponse {
  id: number // Snowflake ID
  api_key: string // Only returned once!
  key_prefix: string
  name: string
}

interface ApiKeyInfo {
  id: number
  key_prefix: string
  name: string
  description?: string
  owner_address?: string
  is_active: boolean
  created_at: string
  expires_at?: string
  last_used_at?: string
  request_count: number
}

interface ApiKeyListResponse {
  api_keys: ApiKeyInfo[]
  total: number
}
```

## Error Codes

| Code | Description                                                        |
| ---- | ------------------------------------------------------------------ |
| 400  | Bad Request                                                        |
| 401  | Auth failed / Invalid API Key                                      |
| 404  | Not found                                                          |
| 408  | Timeout (salt mining)                                              |
| 413  | File too large                                                     |
| 429  | Rate limit (`retry_after` in response = seconds until next minute) |
| 500  | Server error                                                       |

## Security

- **Store securely**: `api_key` returned only once at creation. Cannot be retrieved later.
- **If lost**: List keys → find ID by `key_prefix`/`name` → Delete → Create new
- **Use env vars**: `process.env.NAD_API_KEY`, never hardcode
- **Set expiration**: Rotate keys periodically
- **Delete immediately**: If key is compromised, delete via API (cannot be undone)
