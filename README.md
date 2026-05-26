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
2. **Systems thinking (20s)** — Cycle through Benefit → Concern → Ethical question in the right panel.
3. **Trigger Grid Crisis (45s)** — Click the button. Watch:
   - Red **grid overload** and **human access throttled** banners
   - Map nodes pulse red; migration lines animate
   - Human allocation drops (~62% → ~12%); agent allocation rises
   - Feed prioritizes ethics/grid events
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

## Project structure

```
src/
  App.tsx                 # Main dashboard + simulation loop
  components/
    WorldMap.tsx          # SVG global map
    SystemsThinkingPanel.tsx
    AllocationMeters.tsx
  lib/
    data.ts               # Default nodes, seed events, insights
    simulation.ts         # Market drift + crisis bursts
```

## What this project is really about

> **What happens when AI becomes an autonomous economic actor?**

The UI simulates unintended consequences: agents optimize for cost and compute while humans can be priced out of critical infrastructure — a systems-thinking story about governance, ethics, and grid fragility.

## License

MIT (add a LICENSE file if needed for your course submission).
