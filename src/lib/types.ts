export type MarketNode = {
  id: string;
  name: string;
  regionTag: string;
  mapX: number;
  mapY: number;
  energyPrice: number;
  gpuSupply: number;
  renewablePct: number;
  carbonScore: number;
  workloadsActive: number;
  efficiencyScore: number;
};

export type ActivityKind = "migration" | "purchase" | "market" | "grid" | "ethics";

export type Activity = {
  id: string;
  at: number;
  message: string;
  kind: ActivityKind;
  fromNodeId?: string;
  toNodeId?: string;
};

export type CrisisState = {
  active: boolean;
  untilMs: number;
  severity: number;
};

export type MigrationArc = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  startedAt: number;
};

export type SystemsInsight = {
  id: string;
  label: string;
  title: string;
  body: string;
};
