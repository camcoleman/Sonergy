import { baseSepolia, optimismSepolia, arbitrumSepolia } from "wagmi/chains";

export const SUPPORTED_CHAINS = [baseSepolia, optimismSepolia, arbitrumSepolia] as const;

export const DEFAULT_CHAIN_ID = baseSepolia.id;

