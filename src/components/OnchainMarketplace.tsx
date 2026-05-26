import { useMemo, useState } from "react";
import { keccak256, toBytes, formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, useReadContract, useWatchContractEvent, useWriteContract } from "wagmi";
import type { Activity } from "../lib/types";
import { uid } from "../lib/utils";
import { ADDRESSES_BY_CHAIN } from "../web3/addresses";
import { Marketplace_ABI, MockUSDC_ABI, ResourceType, Side } from "../web3/contracts";

type Props = {
  nodes: { id: string; name: string }[];
  onNewOnchainActivity: (a: Activity) => void;
};

type Tab = "telemetry" | "onchain";

function nodeHash(nodeId: string) {
  return keccak256(toBytes(nodeId));
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function OnchainMarketplace({ nodes, onNewOnchainActivity }: Props) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const addrs = ADDRESSES_BY_CHAIN[chainId];

  const [tab, setTab] = useState<Tab>("telemetry");

  const [resourceType, setResourceType] = useState<0 | 1>(ResourceType.GPU_HOUR);
  const [side, setSide] = useState<0 | 1>(Side.BUY);
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? "oregon-solar");
  const [unitPriceUsd, setUnitPriceUsd] = useState("0.25"); // USDC
  const [quantity, setQuantity] = useState("10");

  const marketplaceAddress = addrs?.marketplace;
  const usdcAddress = addrs?.mockUSDC;

  const { data: openOrderIds } = useReadContract({
    abi: Marketplace_ABI,
    address: marketplaceAddress,
    functionName: "getOpenOrderIds",
    query: { enabled: Boolean(marketplaceAddress) && tab === "onchain" },
  });

  const orderIds = useMemo(() => {
    if (!openOrderIds) return [];
    return [...(openOrderIds as bigint[])];
  }, [openOrderIds]);

  const orders = orderIds.map((id) =>
    useReadContract({
      abi: Marketplace_ABI,
      address: marketplaceAddress,
      functionName: "orders",
      args: [id],
      query: { enabled: Boolean(marketplaceAddress) && tab === "onchain" },
    }),
  );

  const { writeContractAsync, isPending } = useWriteContract();

  const canUseOnchain = Boolean(isConnected && marketplaceAddress && usdcAddress);

  useWatchContractEvent({
    abi: Marketplace_ABI,
    address: marketplaceAddress,
    eventName: "OrderCreated",
    enabled: Boolean(marketplaceAddress),
    onLogs: (logs) => {
      logs.forEach((l) => {
        const args = l.args as any;
        onNewOnchainActivity({
          id: uid("onchain"),
          at: Date.now(),
          kind: "market",
          message: `On-chain: OrderCreated #${args.orderId?.toString?.() ?? ""} by ${shortAddr(args.maker)}.`,
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
        const args = l.args as any;
        onNewOnchainActivity({
          id: uid("onchain"),
          at: Date.now(),
          kind: "purchase",
          message: `On-chain: OrderFilled #${args.orderId?.toString?.() ?? ""} amount ${args.amount?.toString?.() ?? ""} (paid ${formatUnits(args.totalPaid ?? 0n, 6)} USDC).`,
        });
      });
    },
  });

  async function createOrder() {
    if (!canUseOnchain) return;
    const price = parseUnits(unitPriceUsd || "0", 6);
    const qty = BigInt(Math.max(0, Number(quantity || 0)));
    const hash = nodeHash(nodeId);

    await writeContractAsync({
      abi: Marketplace_ABI,
      address: marketplaceAddress!,
      functionName: "createOrder",
      args: [resourceType, side, hash, price, qty, 0],
    });
  }

  async function fillOrder(orderId: bigint, amount: bigint, maker: `0x${string}`, orderSide: number) {
    if (!canUseOnchain || !address) return;

    // Approve buyer to pay (buyer depends on order side)
    const buyer = orderSide === Side.BUY ? maker : (address as `0x${string}`);
    const isBuyerMe = buyer.toLowerCase() === address.toLowerCase();
    if (isBuyerMe) {
      const price = parseUnits(unitPriceUsd || "0", 6);
      const total = amount * price;
      await writeContractAsync({
        abi: MockUSDC_ABI,
        address: usdcAddress!,
        functionName: "approve",
        args: [marketplaceAddress!, total],
      });
    }

    await writeContractAsync({
      abi: Marketplace_ABI,
      address: marketplaceAddress!,
      functionName: "fillOrder",
      args: [orderId, amount],
    });
  }

  return (
    <div className="onchainWrap">
      <div className="tabs">
        <button type="button" className={`tab ${tab === "telemetry" ? "tab--active" : ""}`} onClick={() => setTab("telemetry")}>
          Simulated telemetry
        </button>
        <button type="button" className={`tab ${tab === "onchain" ? "tab--active" : ""}`} onClick={() => setTab("onchain")}>
          On-chain orders
        </button>
      </div>

      {tab === "telemetry" ? (
        <div className="onchainHint">This table is simulation-backed. Switch to “On-chain orders” to view real contract state.</div>
      ) : null}

      {tab === "onchain" ? (
        <div className="onchainPanel">
          {!marketplaceAddress || !usdcAddress ? (
            <div className="onchainHint">
              No contract addresses configured for chainId <strong>{chainId}</strong>. Add them in <code>src/web3/addresses.ts</code>.
            </div>
          ) : null}

          <div className="onchainForm">
            <div className="onchainRow">
              <label>
                Resource
                <select value={resourceType} onChange={(e) => setResourceType(Number(e.target.value) as 0 | 1)} disabled={!canUseOnchain}>
                  <option value={ResourceType.GPU_HOUR}>GPU-hour</option>
                  <option value={ResourceType.KWH}>kWh</option>
                </select>
              </label>

              <label>
                Side
                <select value={side} onChange={(e) => setSide(Number(e.target.value) as 0 | 1)} disabled={!canUseOnchain}>
                  <option value={Side.BUY}>Buy</option>
                  <option value={Side.SELL}>Sell</option>
                </select>
              </label>
            </div>

            <div className="onchainRow">
              <label>
                Node
                <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!canUseOnchain}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="onchainRow">
              <label>
                Unit price (USDC)
                <input value={unitPriceUsd} onChange={(e) => setUnitPriceUsd(e.target.value)} disabled={!canUseOnchain} />
              </label>
              <label>
                Quantity
                <input value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!canUseOnchain} />
              </label>
            </div>

            <button type="button" className="btn" onClick={createOrder} disabled={!canUseOnchain || isPending}>
              Create on-chain order
            </button>
          </div>

          <div className="onchainOrders">
            <div className="onchainOrdersHeader">
              <strong>Open orders</strong>
              <span className="muted">{orderIds.length} open</span>
            </div>

            {orders.length === 0 ? <div className="onchainHint">No open orders yet.</div> : null}

            {orders.map((q, idx) => {
              const id = orderIds[idx];
              const o = q.data as any[] | undefined;
              if (!o) return null;
              const maker = o[0] as `0x${string}`;
              const rType = Number(o[1]);
              const s = Number(o[2]);
              const unitPrice = o[4] as bigint;
              const qty = o[5] as bigint;
              const filled = o[6] as bigint;
              const remaining = qty - filled;

              return (
                <div key={id.toString()} className="orderCard">
                  <div className="orderTop">
                    <div>
                      <strong>#{id.toString()}</strong> <span className="muted">{rType === 0 ? "GPU-hour" : "kWh"}</span>{" "}
                      <span className={`orderSide ${s === 0 ? "orderSide--buy" : "orderSide--sell"}`}>{s === 0 ? "BUY" : "SELL"}</span>
                    </div>
                    <div className="muted">{shortAddr(maker)}</div>
                  </div>
                  <div className="orderMeta">
                    <span>
                      Price: <strong>{formatUnits(unitPrice, 6)} USDC</strong>
                    </span>
                    <span>
                      Remaining: <strong>{remaining.toString()}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={!canUseOnchain || remaining === 0n || isPending}
                    onClick={() => fillOrder(id, remaining > 1n ? 1n : remaining, maker, s)}
                  >
                    Fill 1 unit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

