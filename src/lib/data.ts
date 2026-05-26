import type { Activity, MarketNode, SystemsInsight } from "./types";
import { uid } from "./utils";

export const DEFAULT_NODES: MarketNode[] = [
  {
    id: "oregon-solar",
    name: "Oregon Solar Node",
    regionTag: "USA / NW",
    lat: 45.5231,
    lng: -122.6765,
    energyPrice: 0.08,
    gpuSupply: 82,
    renewablePct: 96,
    carbonScore: 8,
    workloadsActive: 62,
    efficiencyScore: 80,
  },
  {
    id: "texas-grid",
    name: "Texas Compute Farm",
    regionTag: "USA / TX",
    lat: 32.7767,
    lng: -96.797,
    energyPrice: 0.05,
    gpuSupply: 68,
    renewablePct: 41,
    carbonScore: 32,
    workloadsActive: 49,
    efficiencyScore: 63,
  },
  {
    id: "tokyo-gpu",
    name: "Tokyo GPU Grid",
    regionTag: "JPN / Kanto",
    lat: 35.6762,
    lng: 139.6503,
    energyPrice: 0.11,
    gpuSupply: 74,
    renewablePct: 52,
    carbonScore: 27,
    workloadsActive: 55,
    efficiencyScore: 70,
  },
  {
    id: "iceland-green",
    name: "Iceland Green Cluster",
    regionTag: "ISL / Reykjavik",
    lat: 64.1466,
    lng: -21.9426,
    energyPrice: 0.07,
    gpuSupply: 54,
    renewablePct: 93,
    carbonScore: 10,
    workloadsActive: 44,
    efficiencyScore: 76,
  },
];

export const STEADY_HUMAN_ALLOCATION = 62;
export const STEADY_AGENT_ALLOCATION = 38;
export const CRISIS_HUMAN_ALLOCATION = 12;
export const CRISIS_AGENT_ALLOCATION = 88;

export function cloneDefaultNodes(): MarketNode[] {
  return DEFAULT_NODES.map((n) => ({ ...n }));
}

export function seedActivity(): Activity[] {
  const now = Date.now();
  return [
    {
      id: uid("evt"),
      at: now - 35_000,
      kind: "migration",
      message: "ResearchAgent_12 migrated workloads to Iceland due to lower carbon costs.",
      fromNodeId: "tokyo-gpu",
      toNodeId: "iceland-green",
    },
    {
      id: uid("evt"),
      at: now - 20_000,
      kind: "purchase",
      message: "TradingAgent_7 purchased 40 GPU hours from Oregon Solar Node.",
      toNodeId: "oregon-solar",
    },
    {
      id: uid("evt"),
      at: now - 9_000,
      kind: "market",
      message: "Energy prices increased 18% due to AI demand spike.",
    },
  ];
}

export const SYSTEMS_INSIGHTS: SystemsInsight[] = [
  {
    id: "benefit",
    label: "Benefit",
    title: "Global efficiency gains",
    body: "AI dynamically optimizes unused infrastructure globally, reducing waste and improving efficiency.",
  },
  {
    id: "concern",
    label: "Concern",
    title: "Profit over stability",
    body: "Autonomous systems may prioritize profit over human stability when bidding for scarce resources.",
  },
  {
    id: "failure",
    label: "Failure scenario",
    title: "Regional grid overload",
    body: "AI agents overload regional power grids while optimizing for profit and compute efficiency.",
  },
  {
    id: "ethics",
    label: "Ethical question",
    title: "Who gets the grid?",
    body: "Should AI agents be allowed to compete with humans for critical infrastructure resources like electricity?",
  },
];
