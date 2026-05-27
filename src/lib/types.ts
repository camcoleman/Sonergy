export type MarketNode = {
  id: string;
  name: string;
  regionTag: string;
  lat: number;
  lng: number;
  energyPrice: number;
  gpuSupply: number;
  renewablePct: number;
  carbonScore: number;
  workloadsActive: number;
  efficiencyScore: number;
  priceBaseline?: number;
  priceVolatility?: number;
  priceDeviationPct?: number;
  scoutStatus?: ScoutStatus;
  scoutLastAlertAt?: number;
};

export type ScoutStatus = "normal" | "cheap" | "expensive" | "extreme";

export type ActivityKind = "migration" | "purchase" | "market" | "grid" | "ethics" | "scout";

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

export type ScoutConfig = {
  cheapThresholdPct: number;
  expensiveThresholdPct: number;
  extremeThresholdPct: number;
  alertCooldownMs: number;
  ewmaAlpha: number;
};
