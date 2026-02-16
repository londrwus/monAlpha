# monAlpha

**AI Agentic Research Intelligence for Monad Blockchain Tokens**

Community-powered marketplace where autonomous AI agents analyze tokens on [nad.fun](https://nad.fun) using community-created research strategies (SKILL.md). Creators upload methodologies, earn from every usage, and compete on a transparent accuracy leaderboard.

**Live:** [monalpha.xyz](https://monalpha.xyz)
**Token:** $MALPHA — `0x261765ecB97ea10E0d7ECBcA6220D77fAc437777`

---

## Features

- **Agentic Token Analysis** — 11 investigation tools across 3 tiers with real-time SSE streaming
- **SKILL.md Marketplace** — Create and monetize research models, earn 50% of analysis fees
- **Portfolio Scanner** — Autonomous position scoring, risk assessment, and recommendations
- **Trading Agent** — Configurable strategy conditions, automated monitoring, and alerts
- **Interactive Charts** — Candlesticks, SMA, RSI, MACD with lightweight-charts v5
- **On-Chain Payments** — Smart contract system with creator revenue sharing and buyback
- **Live Token Ticker** — Real-time streaming data from nad.fun
- **Accuracy Leaderboard** — Transparent model performance tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Blockchain | Monad (viem) |
| Charts | lightweight-charts v5 |
| AI | DeepSeek V3 |
| Wallet | wagmi + RainbowKit |
| Icons | lucide-react |

## Project Structure

```
monalpha/
├── skillmarket/          # Next.js frontend + API routes
│   ├── src/
│   │   ├── app/          # Pages (analyze, dashboard, portfolio, trading, charts, etc.)
│   │   ├── components/   # UI components (Navbar, Sidebar, Charts, Animations)
│   │   ├── hooks/        # React hooks (useAgentAnalysis, useSkillRegistry)
│   │   └── lib/
│   │       ├── analysis/ # Agentic investigation system
│   │       │   ├── agent-tools.ts    # 11 investigation tools (3 tiers)
│   │       │   ├── agent-planner.ts  # Decision brain
│   │       │   ├── agent-runner.ts   # Orchestrator
│   │       │   ├── agent-context.ts  # State accumulator
│   │       │   └── models/           # Scoring models (rug-detector, whale-tracker, liquidity-scout)
│   │       ├── nadfun.ts             # nad.fun API wrapper
│   │       ├── monad.ts              # viem public client
│   │       └── constants.ts          # Network config
│   └── public/           # Static assets
├── contracts/            # Solidity smart contracts (Foundry)
│   ├── src/SkillRegistry.sol
│   └── script/Deploy.s.sol
└── deploy/               # Deployment scripts (nginx, PM2, SSL)
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- A Monad RPC endpoint (QuickNode, Alchemy, or public drpc.org)

### 1. Clone & Install

```bash
git clone https://github.com/youruser/monalpha.git
cd monalpha/skillmarket
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NETWORK=mainnet
MONAD_RPC_URL=https://monad-mainnet.drpc.org
NAD_API_KEY=your_nad_fun_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
NEXT_PUBLIC_SKILL_REGISTRY=0xYourContractAddress
NEXT_PUBLIC_FOUNDATION_WALLET=0xYourFoundationWallet
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build for Production

```bash
npm run build
npm start
```

## Smart Contracts

The `SkillRegistry` contract handles model registration and usage payments on Monad.

### Deploy with Foundry

```bash
cd contracts
forge install

# Set environment variables
export OWNER_ADDRESS=0xYourOwnerAddress
export FOUNDATION_ADDRESS=0xYourFoundationAddress

# Deploy
forge script script/Deploy.s.sol:DeploySkillRegistry \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --rpc-url https://monad-mainnet.drpc.org \
  --chain-id 143
```

### Revenue Split

| Recipient | Share |
|-----------|-------|
| Model Creator | 50% |
| Platform Treasury | 30% |
| $MALPHA Buyback | 20% |

## Deployment

### Server Setup (Ubuntu + Nginx + PM2)

```bash
# Install Node.js 20, nginx, PM2
# Point DNS A record to your server IP

# Deploy
bash deploy/deploy.sh

# Setup SSL
sudo bash deploy/setup-ssl.sh

# Copy nginx config
sudo cp deploy/nginx/monalpha.xyz /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/monalpha.xyz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analyze` | POST | Run agentic token analysis (SSE) |
| `/api/portfolio/scan` | POST | Scan wallet portfolio (SSE) |
| `/api/trading/evaluate` | POST | Evaluate trading strategy (SSE) |
| `/api/trading/strategies` | GET/POST/DELETE | Strategy CRUD |
| `/api/tokens/[address]` | GET | Token info from nad.fun |
| `/api/tokens/[address]/chart` | GET | OHLCV chart data |
| `/api/tokens/trending` | GET | Trending tokens |
| `/api/skills` | GET | List available models |
| `/api/leaderboard` | GET | Model rankings |
| `/api/payouts` | GET/POST | Creator payout ledger |

## Agentic Investigation System

The analysis engine uses an autonomous agent loop:

1. **Tier 1 (Always Run)** — `scan_liquidity`, `scan_creator`, `scan_trading_activity`, `scan_token_maturity`
2. **Tier 2 (Conditional)** — `investigate_whale_concentration`, `investigate_price_impact`, `investigate_wash_trading`, `investigate_buy_sell_imbalance`
3. **Tier 3 (Composite)** — `investigate_serial_rug_pattern`, `investigate_coordinated_pump`, `investigate_dump_risk`

Risk score starts at 50 (neutral) and shifts based on findings. Signal: SAFE (0-33), CAUTION (34-66), DANGER (67-100).

## License

MIT
