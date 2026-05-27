import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import {
  resourceLabel,
  resourceShort,
  unitPriceForResource,
  type ResourceKind,
} from "../lib/marketplace";
import { fmtCurrency } from "../lib/utils";
import type { BuyDraft } from "./BuyOrderSheet";
import { Marketplace_ABI, MockUSDC_ABI, ResourceType, Side } from "../web3/contracts";
import { ADDRESSES_BY_CHAIN } from "../web3/addresses";

type NodeRef = {
  id: string;
  name: string;
  energyPrice: number;
  gpuSupply: number;
};

type Props = {
  nodes: NodeRef[];
  buyIntent: BuyDraft | null;
  onBuyIntent: (draft: BuyDraft) => void;
  chainId: number;
  canUseOnchain: boolean;
  isPending: boolean;
  createBuyOrder: (params: {
    nodeId: string;
    resource: ResourceKind;
    unitPriceUsd: string;
    quantity: number;
  }) => Promise<void>;
};

type Tab = "marketplace" | "onchain";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function OnchainMarketplace({
  nodes,
  buyIntent,
  onBuyIntent,
  chainId,
  canUseOnchain,
  isPending,
  createBuyOrder,
}: Props) {
  const { address } = useAccount();
  const addrs = ADDRESSES_BY_CHAIN[chainId];
  const marketplaceAddress = addrs?.marketplace;
  const usdcAddress = addrs?.mockUSDC;

  const [tab, setTab] = useState<Tab>("marketplace");
  const [resource, setResource] = useState<ResourceKind>("energy");
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? "oregon-solar");
  const [quantity, setQuantity] = useState("10");

  const selectedNode = nodes.find((n) => n.id === nodeId);
  const unitPrice = selectedNode ? unitPriceForResource(selectedNode, resource) : 0;

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

  const { writeContractAsync } = useWriteContract();

  function submitPanelBuy() {
    onBuyIntent({
      nodeId,
      resource,
      quantity: Math.max(1, Number(quantity) || 1),
    });
  }

  async function fillOrder(
    orderId: bigint,
    amount: bigint,
    maker: `0x${string}`,
    orderSide: number,
    unitPriceRaw: bigint,
  ) {
    if (!canUseOnchain || !address || !marketplaceAddress || !usdcAddress) return;

    const buyer = orderSide === Side.BUY ? maker : (address as `0x${string}`);
    const isBuyerMe = buyer.toLowerCase() === address.toLowerCase();
    if (isBuyerMe) {
      const total = amount * unitPriceRaw;
      await writeContractAsync({
        abi: MockUSDC_ABI,
        address: usdcAddress,
        functionName: "approve",
        args: [marketplaceAddress, total],
      });
    }

    await writeContractAsync({
      abi: Marketplace_ABI,
      address: marketplaceAddress,
      functionName: "fillOrder",
      args: [orderId, amount],
    });
  }

  const activeIntent = buyIntent ?? null;

  return (
    <div className="onchainWrap">
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "marketplace" ? "tab--active" : ""}`}
          onClick={() => setTab("marketplace")}
        >
          Marketplace
        </button>
        <button type="button" className={`tab ${tab === "onchain" ? "tab--active" : ""}`} onClick={() => setTab("onchain")}>
          On-chain ledger
        </button>
      </div>

      {tab === "marketplace" ? (
        <div className="marketplacePanel">
          <div className="marketplaceHint">
            Hover a city on the map for quick buy, or configure an order here. Simulated fills post to the trade tape
            instantly.
          </div>

          <div className="onchainForm marketplaceForm">
            <div className="onchainRow">
              <label>
                Venue
                <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name.replace(" Node", "")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Resource
                <select value={resource} onChange={(e) => setResource(e.target.value as ResourceKind)}>
                  <option value="energy">Energy (kWh)</option>
                  <option value="compute">Compute (GPU-hour)</option>
                </select>
              </label>
            </div>

            <div className="marketplaceQuote">
              <div>
                <span className="muted">Live quote</span>
                <strong>
                  {resource === "energy"
                    ? fmtCurrency(unitPrice)
                    : `$${unitPrice.toFixed(3)}/${resourceLabel(resource)}`}
                </strong>
              </div>
              {selectedNode ? (
                <div>
                  <span className="muted">GPU supply</span>
                  <strong>{Math.round(selectedNode.gpuSupply)}%</strong>
                </div>
              ) : null}
            </div>

            <div className="onchainRow">
              <label>
                Quantity ({resourceLabel(resource)})
                <input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
            </div>

            <button type="button" className="btn btnPrimary" onClick={submitPanelBuy}>
              Review & buy
            </button>
          </div>

          {activeIntent ? (
            <div className="marketplacePending">
              Pending order: <strong>{resourceShort(activeIntent.resource)}</strong> @{" "}
              {nodes.find((n) => n.id === activeIntent.nodeId)?.name.replace(" Node", "") ?? activeIntent.nodeId}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "onchain" ? (
        <div className="onchainPanel">
          {!marketplaceAddress || !usdcAddress ? (
            <div className="onchainHint">
              No contract addresses configured for chainId <strong>{chainId}</strong>. Add them in{" "}
              <code>src/web3/addresses.ts</code>.
            </div>
          ) : null}

          <div className="onchainHint">
            Connect a wallet on a supported testnet to create or fill real orders. Map buys can also submit here via the
            order sheet.
          </div>

          <div className="onchainForm">
            <div className="onchainRow">
              <label>
                Resource
                <select
                  value={resource === "compute" ? ResourceType.GPU_HOUR : ResourceType.KWH}
                  onChange={(e) => setResource(Number(e.target.value) === ResourceType.GPU_HOUR ? "compute" : "energy")}
                  disabled={!canUseOnchain}
                >
                  <option value={ResourceType.GPU_HOUR}>GPU-hour</option>
                  <option value={ResourceType.KWH}>kWh</option>
                </select>
              </label>
              <label>
                Side
                <select disabled defaultValue={Side.BUY}>
                  <option value={Side.BUY}>Buy</option>
                </select>
              </label>
            </div>

            <div className="onchainRow">
              <label>
                Venue
                <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!canUseOnchain}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className="btn"
              disabled={!canUseOnchain || isPending}
              onClick={() =>
                createBuyOrder({
                  nodeId,
                  resource,
                  unitPriceUsd: unitPrice.toFixed(6),
                  quantity: Math.max(1, Number(quantity) || 1),
                })
              }
            >
              Create on-chain buy order
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
              const o = q.data as unknown[] | undefined;
              if (!o) return null;
              const maker = o[0] as `0x${string}`;
              const rType = Number(o[1]);
              const s = Number(o[2]);
              const unitPriceRaw = o[4] as bigint;
              const qty = o[5] as bigint;
              const filled = o[6] as bigint;
              const remaining = qty - filled;

              return (
                <div key={id.toString()} className="orderCard">
                  <div className="orderTop">
                    <div>
                      <strong>#{id.toString()}</strong>{" "}
                      <span className="muted">{rType === ResourceType.GPU_HOUR ? "GPU-hour" : "kWh"}</span>{" "}
                      <span className={`orderSide ${s === Side.BUY ? "orderSide--buy" : "orderSide--sell"}`}>
                        {s === Side.BUY ? "BUY" : "SELL"}
                      </span>
                    </div>
                    <div className="muted">{shortAddr(maker)}</div>
                  </div>
                  <div className="orderMeta">
                    <span>
                      Price: <strong>{formatUnits(unitPriceRaw, 6)} USDC</strong>
                    </span>
                    <span>
                      Remaining: <strong>{remaining.toString()}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={!canUseOnchain || remaining === 0n || isPending}
                    onClick={() => fillOrder(id, remaining > 1n ? 1n : remaining, maker, s, unitPriceRaw)}
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
