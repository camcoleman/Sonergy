import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = privateKey ? [privateKey] : [];
const invalidUrl = "https://example.invalid";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    baseSepolia: {
      type: "http",
      url: process.env.RPC_URL_BASE_SEPOLIA || invalidUrl,
      accounts,
    },
    optimismSepolia: {
      type: "http",
      url: process.env.RPC_URL_OPTIMISM_SEPOLIA || invalidUrl,
      accounts,
    },
    arbitrumSepolia: {
      type: "http",
      url: process.env.RPC_URL_ARBITRUM_SEPOLIA || invalidUrl,
      accounts,
    },
  },
});

