import type { Abi } from "viem";
import mockUsdcJson from "../abi/MockUSDC.json";
import marketplaceJson from "../abi/ResourceMarketplace.json";

export const MockUSDC_ABI = (mockUsdcJson as { abi: Abi }).abi;
export const Marketplace_ABI = (marketplaceJson as { abi: Abi }).abi;

export const ResourceType = {
  GPU_HOUR: 0,
  KWH: 1,
} as const;

export const Side = {
  BUY: 0,
  SELL: 1,
} as const;

