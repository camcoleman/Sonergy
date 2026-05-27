# Sonergy

**Autonomous AI infrastructure markets for energy and compute.**

Sonergy is a decentralized marketplace demo where autonomous AI agents buy, sell, and optimize global energy and compute resources in real time. This repository is a presentation-ready **interactive mock** — not production blockchain infrastructure.

## Live demo

After GitHub Pages is enabled (see [Deploy](#deploy)), the app will be available at:

**https://camcoleman.github.io/Sonergy/**

## Problem & solution

| | |
|---|---|
| **Problem** | AI systems consume massive electricity and GPU compute while global infrastructure stays inefficient and centralized. |
| **Solution** | Sonergy lets AI agents autonomously negotiate for cheaper, greener, more efficient compute and energy across a decentralized marketplace. |

## Core demo features

- **Live resource marketplace** — energy cost, GPU supply, renewables, active workloads
- **Global infrastructure map** — animated nodes, migration arcs, overload labels during crisis
- **Autonomous AI agent feed** — migrations, purchases, market spikes, ethics events
- **Sustainability metrics** — carbon scores, renewables, efficiency
- **Trigger Grid Crisis** — price spikes, red alerts, agent bidding, humans priced out
- **Systems thinking panel** — benefit, concern, failure scenario, ethical question
- **Reset demo** — restores a clean baseline for repeatable presentations
- **On-chain marketplace** — wallet connect + real on-chain orders/fills (MockUSDC + ResourceMarketplace)
- **Price Scout alerts** — rolling baseline model flags cheap/expensive/extreme regional price dislocations

## Run locally

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

Build for production:

```bash
npm run build
npm run preview
```

## Presentation script (2 minutes)

1. **Steady state (30s)** — Point to Oregon, Iceland, Tokyo, Texas. Note renewables and carbon scores. Read one agent feed item.
2. **Price Scout (20s)** — Show the watchlist and explain baseline vs current price deviation (`cheap`, `expensive`, `extreme`).
3. **Trigger Grid Crisis (45s)** — Click the button. Watch:
   - Red **grid overload** and **human access throttled** banners
   - Map nodes pulse red; migration lines animate
   - Human allocation drops (~62% → ~12%); agent allocation rises
   - Feed prioritizes scout/risk/grid events
4. **Discussion (25s)** — *Should AI agents compete with humans for critical infrastructure like electricity?*

5. **Reset demo** — Return to baseline for the next audience.

## Deploy

### GitHub Pages (automated)

1. Push to `main` (workflow in `.github/workflows/deploy.yml` runs on push).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. After the workflow succeeds, visit **https://camcoleman.github.io/Sonergy/**.

### Manual

```bash
GITHUB_ACTIONS=true npm run build
# Upload dist/ to any static host; set base path to /Sonergy/ on GitHub Pages
```

## On-chain marketplace (EVM testnet)

### What’s on-chain
- `MockUSDC` (mintable ERC20, 6 decimals)
- `ResourceMarketplace` (simple orderbook: create/cancel/fill + events)

### Contracts: compile + test

```bash
npm run contracts:compile
npm run contracts:test
```

### Local demo (recommended)

Run the dashboard:

```bash
npm run dev
```

In another terminal, start a local EVM node (Hardhat) in a dedicated terminal session. Then deploy:

```bash
npx hardhat run scripts/deploy.ts
```

The frontend is pre-configured with the deterministic local addresses in `src/web3/addresses.ts` (chainId `31337`).

### Testnet deploy (Base Sepolia recommended)

1. Copy `.env.example` → `.env` and set:
   - `DEPLOYER_PRIVATE_KEY`
   - `RPC_URL_BASE_SEPOLIA`

2. Deploy:

```bash
npx hardhat run scripts/deploy.ts --network baseSepolia
```

3. Copy the printed addresses into `src/web3/addresses.ts` under the Base Sepolia chainId.

### Agent transactions (live “AI” activity)

The agent script posts real on-chain orders. Use `--crisis` to make it aggressively buy.

1. Set in `.env`:
   - `AGENT_PRIVATE_KEY`
   - `CHAIN_ID` (31337 for local, or the testnet chainId)
   - `RPC_URL`

2. Run:

```bash
npm run agents:steady
# or
npm run agents:crisis
```

If you’re running locally and your agent key is also the MockUSDC owner, you can mint with:

```bash
node --loader tsx ./scripts/agents/runAgents.ts --mint-local
```

## Project structure

```
src/
  App.tsx                 # Main dashboard + simulation loop
  components/
    WorldMap.tsx          # Leaflet map
    OnchainMarketplace.tsx
    SystemsThinkingPanel.tsx
    AllocationMeters.tsx
  lib/
    data.ts               # Default nodes, seed events, insights
    simulation.ts         # Market drift + crisis bursts
  web3/
    addresses.ts
    chains.ts
    config.ts
    contracts.ts
contracts/
  MockUSDC.sol
  ResourceMarketplace.sol
scripts/
  deploy.ts
  agents/runAgents.ts
```

## What this project is really about

> **What happens when AI becomes an autonomous economic actor?**

The UI simulates unintended consequences: agents optimize for cost and compute while humans can be priced out of critical infrastructure — a systems-thinking story about governance, ethics, and grid fragility.

## License

MIT (add a LICENSE file if needed for your course submission).
