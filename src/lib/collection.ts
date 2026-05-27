import type { CollectedAsset } from "./types";
import { DEFAULT_NODES } from "./data";

export const DEFAULT_AGENT_ORIGIN_NODE = "tokyo-gpu";

export function resolveNodeIdFromAllocation(allocationNodeId: string): string | null {
  const slug = allocationNodeId.trim().toLowerCase();
  const byId = DEFAULT_NODES.find((n) => n.id.toLowerCase() === slug);
  if (byId) return byId.id;

  const byName = DEFAULT_NODES.find(
    (n) =>
      n.name.toLowerCase().includes(slug) ||
      slug.includes(n.id.replace(/-/g, " ")) ||
      n.regionTag.toLowerCase().includes(slug),
  );
  return byName?.id ?? null;
}

export function venueLabelForAllocation(allocationNodeId: string): string {
  const nodeId = resolveNodeIdFromAllocation(allocationNodeId);
  const node = DEFAULT_NODES.find((n) => n.id === nodeId);
  if (node) return node.name.replace(" Node", "");
  return allocationNodeId;
}

export function resourceTypeFromAccessKey(accessKey: string): "compute" | "energy" {
  return accessKey.startsWith("sonergy_sk_") ? "compute" : "energy";
}

export function shortAccessKey(accessKey: string): string {
  if (accessKey.length <= 28) return accessKey;
  return `${accessKey.slice(0, 18)}…${accessKey.slice(-6)}`;
}

export function buildCollectedAsset(params: {
  orderId: bigint | string;
  buyer: string;
  accessKey: string;
  allocationNodeId: string;
  leaseHours: number;
}): CollectedAsset {
  const resourceType = resourceTypeFromAccessKey(params.accessKey);
  return {
    id: `col-${params.orderId}-${Date.now()}`,
    orderId: params.orderId.toString(),
    buyer: params.buyer,
    accessKey: params.accessKey,
    allocationNodeId: params.allocationNodeId,
    resourceType,
    leaseHoursRemaining: params.leaseHours,
    collectedAt: Date.now(),
    venueLabel: venueLabelForAllocation(params.allocationNodeId),
  };
}
