import type { Activity, CrisisState, MarketNode } from "./types";
import { clamp, pick, round, uid } from "./utils";

export function genMarketUpdate(
  nodes: MarketNode[],
  crisis: CrisisState,
): { next: MarketNode[]; event?: Activity } {
  const now = Date.now();
  const severity = crisis.active ? crisis.severity : 0;

  const updated = nodes.map((n) => {
    const priceDrift = (Math.random() * 0.04 - 0.02) * (1 + severity * 1.3);
    const renewableDrift = (Math.random() * 4 - 2) * (1 + severity * 1.2);
    const supplyDrift = (Math.random() * 10 - 5) * (1 + severity * 0.6);
    const workloadsDrift = (Math.random() * 10 - 5) * (1 + severity * 0.7);
    const efficiencyDrift = (Math.random() * 6 - 3) * (1 + severity * 0.5);

    let nextPrice = n.energyPrice + priceDrift;
    let nextRenew = n.renewablePct + renewableDrift;
    let nextSupply = n.gpuSupply + supplyDrift;
    let nextCarbon = n.carbonScore + (severity > 0 ? 3 + Math.random() * 6 : Math.random() * 2);
    let nextWorkloads = n.workloadsActive + workloadsDrift;
    let nextEfficiency = n.efficiencyScore + efficiencyDrift;

    if (crisis.active) {
      const spike = 1.8 + severity * 0.55;
      nextPrice = n.energyPrice * spike + Math.random() * 0.02;
      nextRenew = n.renewablePct - (10 + severity * 15) + (Math.random() * 4 - 2);
      nextCarbon = n.carbonScore + (8 + severity * 18) + Math.random() * 6;
      nextSupply = n.gpuSupply + (Math.random() * 6 - 3) - severity * 8;
      nextWorkloads = n.workloadsActive + (8 + severity * 18) + (Math.random() * 10 - 5);
      nextEfficiency = n.efficiencyScore - (10 + severity * 18) + (Math.random() * 6 - 3);
    }

    return {
      ...n,
      energyPrice: round(clamp(nextPrice, 0.03, 0.38), 3),
      renewablePct: round(clamp(nextRenew, 5, 100), 1),
      gpuSupply: round(clamp(nextSupply, 8, 100), 1),
      carbonScore: Math.round(clamp(nextCarbon, 4, 99)),
      workloadsActive: round(clamp(nextWorkloads, 0, 100), 1),
      efficiencyScore: Math.round(clamp(nextEfficiency, 15, 100)),
    };
  });

  if (!crisis.active && Math.random() < 0.12) {
    const deltaPct = Math.round(6 + Math.random() * 15);
    const target = pick(updated);
    return {
      next: updated,
      event: {
        id: uid("evt"),
        at: now,
        kind: "market",
        message: `Energy prices increased ${deltaPct}% on ${target.name.split(" ")[0]} due to AI demand.`,
      },
    };
  }

  return { next: updated };
}

export function genCrisisBurst(updatedNodes: MarketNode[]): Activity[] {
  const now = Date.now();
  const agents = ["ResearchAgent", "TradingAgent", "LoadBalancerAgent", "CarbonAwareAgent"];
  const agentIds = [12, 7, 3, 18, 5, 9];

  const cheapest = [...updatedNodes].sort((a, b) => a.energyPrice - b.energyPrice)[0];
  const green = [...updatedNodes].sort((a, b) => b.renewablePct - a.renewablePct)[0];
  const overloaded = [...updatedNodes].sort((a, b) => b.workloadsActive - a.workloadsActive)[0];
  const fromNode = pick(updatedNodes.filter((n) => n.id !== green.id));

  const deltaPrice = Math.round(18 + Math.random() * 34);
  const migrationAgent = `${pick(agents)}_${pick(agentIds)}`;
  const tradingAgent = `${pick(agents)}_${pick(agentIds)}`;

  const activities: Activity[] = [
    {
      id: uid("evt"),
      at: now,
      kind: "ethics",
      message: "Human access throttled — residential allocation reduced to protect agent compute bids.",
    },
    {
      id: uid("evt"),
      at: now + 15,
      kind: "grid",
      message: `Grid overload detected near ${overloaded.name.split(" ")[0]} — capacity is being strained.`,
    },
    {
      id: uid("evt"),
      at: now + 30,
      kind: "market",
      message: `Energy prices spiked ${deltaPrice}% during the grid crisis.`,
    },
    {
      id: uid("evt"),
      at: now + 45,
      kind: "purchase",
      message: `${tradingAgent} purchased 40 GPU hours from ${cheapest.name} to secure compute.`,
      toNodeId: cheapest.id,
    },
    {
      id: uid("evt"),
      at: now + 60,
      kind: "migration",
      message: `${migrationAgent} migrated workloads to ${green.name.split(" ")[0]} due to lower carbon costs.`,
      fromNodeId: fromNode.id,
      toNodeId: green.id,
    },
    {
      id: uid("evt"),
      at: now + 75,
      kind: "ethics",
      message: "Humans are becoming priced out of critical energy as autonomous bidding accelerates.",
    },
  ];

  return activities;
}
