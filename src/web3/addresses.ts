export type AddressMap = {
  mockUSDC: `0x${string}`;
  marketplace: `0x${string}`;
};

// Replace these after testnet deployment (Base Sepolia recommended).
// These defaults are the deterministic Hardhat local addresses printed by `scripts/deploy.ts`.
export const ADDRESSES_BY_CHAIN: Record<number, AddressMap | undefined> = {
  31337: {
    mockUSDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    marketplace: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
  // Base Sepolia (chainId 84532)
  84532: undefined,
  // Optimism Sepolia (chainId 11155420)
  11155420: undefined,
  // Arbitrum Sepolia (chainId 421614)
  421614: undefined,
};

