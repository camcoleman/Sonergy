import "@rainbow-me/rainbowkit/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";
import { wagmiConfig } from "./web3/config";
import { SUPPORTED_CHAINS } from "./web3/chains";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider chains={[...SUPPORTED_CHAINS]}>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>,
);

