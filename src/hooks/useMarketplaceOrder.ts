import { useMemo } from "react";
import { keccak256, toBytes, parseUnits } from "viem";
import { useAccount, useChainId, useWatchContractEvent, useWriteContract } from "wagmi";
import type { Activity } from "../lib/types";
import { resourceLabel, type ResourceKind } from "../lib/marketplace";
import { uid } from "../lib/utils";
import { ADDRESSES_BY_CHAIN } from "../web3/addresses";
import { Marketplace_ABI, ResourceType, Side } from "../web3/contracts";

function nodeHash(nodeId: string) {
  return keccak256(toBytes(nodeId));
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function useMarketplaceOrder(onNewOnchainActivity: (a: Activity) => void) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const addrs = ADDRESSES_BY_CHAIN[chainId];
  const marketplaceAddress = addrs?.marketplace;
  const usdcAddress = addrs?.mockUSDC;
  const { writeContractAsync, isPending } = useWriteContract();

  const canUseOnchain = Boolean(isConnected && marketplaceAddress && usdcAddress);

  useWatchContractEvent({
    abi: Marketplace_ABI,
    address: marketplaceAddress,
    eventName: "OrderCreated",
    enabled: Boolean(marketplaceAddress),
    onLogs: (logs) => {
      logs.forEach((l) => {
        const args = l.args as { orderId?: bigint; maker?: string };
        onNewOnchainActivity({
          id: uid("onchain"),
          at: Date.now(),
          kind: "market",
          message: `On-chain: OrderCreated #${args.orderId?.toString?.() ?? ""} by ${shortAddr(args.maker ?? "0x0")}.`,
        });
      });
    },
  });

  useWatchContractEvent({
    abi: Marketplace_ABI,
    address: marketplaceAddress,
    eventName: "OrderFilled",
    enabled: Boolean(marketplaceAddress),
    onLogs: (logs) => {
      logs.forEach((l) => {
        const args = l.args as { orderId?: bigint; amount?: bigint; totalPaid?: bigint };
        onNewOnchainActivity({
          id: uid("onchain"),
          at: Date.now(),
          kind: "purchase",
          message: `On-chain: OrderFilled #${args.orderId?.toString?.() ?? ""} amount ${args.amount?.toString?.() ?? ""}.`,
        });
      });
    },
  });

  const createBuyOrder = useMemo(
    () =>
      async (params: {
        nodeId: string;
        resource: ResourceKind;
        unitPriceUsd: string;
        quantity: number;
      }) => {
        if (!canUseOnchain || !marketplaceAddress) return;
        const price = parseUnits(params.unitPriceUsd || "0", 6);
        const qty = BigInt(Math.max(1, Math.floor(params.quantity)));
        const resourceType = params.resource === "compute" ? ResourceType.GPU_HOUR : ResourceType.KWH;

        await writeContractAsync({
          abi: Marketplace_ABI,
          address: marketplaceAddress,
          functionName: "createOrder",
          args: [resourceType, Side.BUY, nodeHash(params.nodeId), params.nodeId, price, qty, 0],
        });
      },
    [canUseOnchain, marketplaceAddress, writeContractAsync],
  );

  return {
    chainId,
    marketplaceAddress,
    usdcAddress,
    canUseOnchain,
    isPending,
    createBuyOrder,
    resourceLabel,
  };
}
