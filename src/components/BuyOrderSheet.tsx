import { useEffect, useMemo, useState } from "react";
import type { MarketNode } from "../lib/types";
import {
  resourceLabel,
  resourceShort,
  totalCostUsd,
  unitPriceForResource,
  type ResourceKind,
} from "../lib/marketplace";
import { fmtCurrency } from "../lib/utils";

export type BuyDraft = {
  nodeId: string;
  resource: ResourceKind;
  quantity: number;
};

type Props = {
  open: boolean;
  node: MarketNode | null;
  draft: BuyDraft | null;
  canSubmitOnchain: boolean;
  onchainPending: boolean;
  onClose: () => void;
  onExecuteSimulated: (draft: BuyDraft) => void;
  onSubmitOnchain: (draft: BuyDraft, unitPriceUsd: string) => void;
};

export default function BuyOrderSheet({
  open,
  node,
  draft,
  canSubmitOnchain,
  onchainPending,
  onClose,
  onExecuteSimulated,
  onSubmitOnchain,
}: Props) {
  const [quantity, setQuantity] = useState("10");

  useEffect(() => {
    if (draft) setQuantity(String(draft.quantity));
  }, [draft]);

  const resource = draft?.resource ?? "energy";
  const qtyNum = Math.max(1, Number(quantity) || 1);
  const unitPrice = node ? unitPriceForResource(node, resource) : 0;
  const total = totalCostUsd(unitPrice, qtyNum);

  const title = useMemo(() => {
    if (!node || !draft) return "Market order";
    return `Buy ${resourceShort(draft.resource)} · ${node.name.replace(" Node", "")}`;
  }, [node, draft]);

  if (!open || !node || !draft) return null;

  const liveDraft: BuyDraft = { ...draft, quantity: qtyNum };

  return (
    <div className="buySheetBackdrop" onClick={onClose} role="presentation">
      <div
        className="buySheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="buySheetHeader">
          <div>
            <div className="buySheetEyebrow">Marketplace</div>
            <strong>{title}</strong>
            <div className="muted">{node.regionTag}</div>
          </div>
          <button type="button" className="btn btnGhost buySheetClose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="buySheetGrid">
          <div className="buySheetStat">
            <span>Unit price</span>
            <strong>
              {resource === "energy" ? fmtCurrency(unitPrice) : `$${unitPrice.toFixed(3)}/${resourceLabel(resource)}`}
            </strong>
          </div>
          <div className="buySheetStat">
            <span>GPU supply</span>
            <strong>{Math.round(node.gpuSupply)}%</strong>
          </div>
          <div className="buySheetStat">
            <span>Renewable mix</span>
            <strong>{Math.round(node.renewablePct)}%</strong>
          </div>
          <div className="buySheetStat">
            <span>Carbon score</span>
            <strong>{node.carbonScore}</strong>
          </div>
        </div>

        <label className="buySheetField">
          Quantity ({resourceLabel(resource)})
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            min={1}
          />
        </label>

        <div className="buySheetTotal">
          Est. total <strong>${total.toFixed(2)} USDC</strong>
        </div>

        <div className="buySheetActions">
          <button type="button" className="btn btnPrimary" onClick={() => onExecuteSimulated(liveDraft)}>
            Execute market buy
          </button>
          <button
            type="button"
            className="btn"
            disabled={!canSubmitOnchain || onchainPending}
            onClick={() => onSubmitOnchain(liveDraft, unitPrice.toFixed(6))}
          >
            {canSubmitOnchain ? "Submit on-chain order" : "Connect wallet for on-chain"}
          </button>
        </div>
      </div>
    </div>
  );
}
