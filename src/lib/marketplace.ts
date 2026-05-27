import type { MarketNode } from "./types";
import { round } from "./utils";

export type ResourceKind = "energy" | "compute";

export type BuyDraft = {
  nodeId: string;
  resource: ResourceKind;
  quantity: number;
};

export type PriceableNode = Pick<MarketNode, "energyPrice" | "gpuSupply">;

export function gpuHourPrice(node: PriceableNode): number {
  const scarcity = 1 + (100 - node.gpuSupply) / 120;
  return round(node.energyPrice * 7.5 * scarcity, 3);
}

export function unitPriceForResource(node: PriceableNode, resource: ResourceKind): number {
  return resource === "energy" ? node.energyPrice : gpuHourPrice(node);
}

export function resourceLabel(resource: ResourceKind): string {
  return resource === "energy" ? "kWh" : "GPU-hour";
}

export function resourceShort(resource: ResourceKind): string {
  return resource === "energy" ? "Energy" : "Compute";
}

export function totalCostUsd(unitPrice: number, quantity: number): number {
  return round(unitPrice * quantity, 2);
}
