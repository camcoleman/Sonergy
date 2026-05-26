import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { SUPPORTED_CHAINS } from "./chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "sonergy-demo";

export const wagmiConfig = getDefaultConfig({
  appName: "Sonergy",
  projectId,
  chains: [...SUPPORTED_CHAINS],
  transports: {
    [SUPPORTED_CHAINS[0].id]: http(import.meta.env.VITE_RPC_URL_BASE_SEPOLIA),
    [SUPPORTED_CHAINS[1].id]: http(import.meta.env.VITE_RPC_URL_OPTIMISM_SEPOLIA),
    [SUPPORTED_CHAINS[2].id]: http(import.meta.env.VITE_RPC_URL_ARBITRUM_SEPOLIA),
  },
  ssr: false,
});

