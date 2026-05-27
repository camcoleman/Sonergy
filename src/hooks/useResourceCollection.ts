import { useCallback, useRef } from "react";
import { useChainId, useWatchContractEvent } from "wagmi";
import type { Activity, CollectedAsset, MigrationArc } from "../lib/types";
import {
  buildCollectedAsset,
  DEFAULT_AGENT_ORIGIN_NODE,
  resolveNodeIdFromAllocation,
  resourceTypeFromAccessKey,
  venueLabelForAllocation,
} from "../lib/collection";
import { uid } from "../lib/utils";
import { ADDRESSES_BY_CHAIN } from "../web3/addresses";
import { Marketplace_ABI } from "../web3/contracts";

type Options = {
  agentOriginNodeId?: string;
  onCollectedAsset: (asset: CollectedAsset) => void;
  onCollectionArc: (arc: MigrationArc) => void;
  onTapeEvent: (activity: Activity) => void;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function orderKey(id: bigint | `0x${string}`): string {
  return typeof id === "bigint" ? id.toString() : BigInt(id).toString();
}

export function useResourceCollection({
  agentOriginNodeId = DEFAULT_AGENT_ORIGIN_NODE,
  onCollectedAsset,
  onCollectionArc,
  onTapeEvent,
}: Options) {
  const chainId = useChainId();
  const marketplaceAddress = ADDRESSES_BY_CHAIN[chainId]?.marketplace;
  const fillAmountByOrder = useRef<Map<string, bigint>>(new Map());

  const handleCollected = useCallback(
    (args: {
      orderId?: `0x${string}` | bigint;
      buyer?: string;
      accessKey?: string;
      allocationNodeId?: string;
    }) => {
      if (!args.orderId || !args.buyer || !args.accessKey || !args.allocationNodeId) return;

      const key = orderKey(args.orderId);
      const leaseHours = Number(fillAmountByOrder.current.get(key) ?? 1n);
      fillAmountByOrder.current.delete(key);

      const asset = buildCollectedAsset({
        orderId: key,
        buyer: args.buyer,
        accessKey: args.accessKey,
        allocationNodeId: args.allocationNodeId,
        leaseHours,
      });

      onCollectedAsset(asset);

      const plantNodeId = resolveNodeIdFromAllocation(args.allocationNodeId) ?? args.allocationNodeId;
      const resourceType = resourceTypeFromAccessKey(args.accessKey);
      const venue = venueLabelForAllocation(args.allocationNodeId);

      if (resourceType === "energy") {
        onCollectionArc({
          id: uid("col-arc"),
          fromNodeId: agentOriginNodeId,
          toNodeId: plantNodeId,
          startedAt: Date.now(),
          kind: "collection",
          durationMs: 14_000,
        });
        onTapeEvent({
          id: uid("col"),
          at: Date.now(),
          kind: "migration",
          message: `Collection: workload migration arc → ${venue} (${leaseHours} kWh local processing).`,
          fromNodeId: agentOriginNodeId,
          toNodeId: plantNodeId,
        });
      } else {
        onTapeEvent({
          id: uid("col"),
          at: Date.now(),
          kind: "purchase",
          message: `Collection: access key for ${leaseHours} GPU-h @ ${venue} (${shortAddr(args.buyer)}).`,
          toNodeId: plantNodeId,
        });
      }
    },
    [agentOriginNodeId, onCollectedAsset, onCollectionArc, onTapeEvent],
  );

  useWatchContractEvent({
    abi: Marketplace_ABI,
    address: marketplaceAddress,
    eventName: "OrderFilled",
    enabled: Boolean(marketplaceAddress),
    onLogs: (logs) => {
      logs.forEach((l) => {
        const args = l.args as { orderId?: bigint; amount?: bigint };
        if (args.orderId == null || args.amount == null) return;
        fillAmountByOrder.current.set(args.orderId.toString(), args.amount);
      });
    },
  });

  useWatchContractEvent({
    abi: Marketplace_ABI,
    address: marketplaceAddress,
    eventName: "ResourceCollected",
    enabled: Boolean(marketplaceAddress),
    onLogs: (logs) => {
      logs.forEach((l) => {
        const args = l.args as {
          orderId?: `0x${string}`;
          buyer?: string;
          accessKey?: string;
          allocationNodeId?: string;
        };
        handleCollected(args);
      });
    },
  });
}
