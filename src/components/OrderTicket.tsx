import { useEffect, useState } from "react";
import type { MarketNode } from "../lib/types";
import {
  resourceLabel,
  resourceShort,
  totalCostUsd,
  unitPriceForResource,
  type ResourceKind,
} from "../lib/marketplace";
import { fmtCurrency } from "../lib/utils";
import type { BuyDraft } from "../lib/marketplace";

type Props = {
  node: MarketNode | null;
  draft: BuyDraft | null;
  canSubmitOnchain: boolean;
  onchainPending: boolean;
  onDraftChange: (draft: BuyDraft) => void;
  onClear: () => void;
  onExecuteSimulated: (draft: BuyDraft) => void;
  onSubmitOnchain: (draft: BuyDraft, unitPriceUsd: string) => void;
};

export default function OrderTicket({
  node,
  draft,
  canSubmitOnchain,
  onchainPending,
  onDraftChange,
  onClear,
  onExecuteSimulated,
  onSubmitOnchain,
}: Props) {
  const [quantity, setQuantity] = useState("10");

  useEffect(() => {
    if (draft) setQuantity(String(draft.quantity));
  }, [draft?.nodeId, draft?.resource, draft?.quantity]);

  if (!node || !draft) {
    return (
      <div className="orderTicket orderTicket--empty">
        <div className="orderTicketHeader">
          <span className="orderTicketLabel">ORDER TICKET</span>
        </div>
        <div className="orderTicketEmptyMsg">Select a venue on the map or blotter to load a ticket.</div>
      </div>
    );
  }

  const resource = draft.resource;
  const qtyNum = Math.max(1, Number(quantity) || 1);
  const unitPrice = unitPriceForResource(node, resource);
  const total = totalCostUsd(unitPrice, qtyNum);
  const liveDraft: BuyDraft = { ...draft, quantity: qtyNum };
  const venue = node.name.replace(" Node", "");

  return (
    <div className="orderTicket">
      <div className="orderTicketHeader">
        <div>
          <span className="orderTicketLabel">ORDER TICKET</span>
          <strong className="orderTicketVenue">{venue}</strong>
          <span className="orderTicketTag">{node.regionTag}</span>
        </div>
        <button type="button" className="btn btnGhost btnXs" onClick={onClear}>
          CLR
        </button>
      </div>

      <div className="orderTicketSide">
        <button
          type="button"
          className={`orderTicketSideBtn ${resource === "energy" ? "orderTicketSideBtn--active" : ""}`}
          onClick={() => onDraftChange({ ...draft, resource: "energy" })}
        >
          BUY ENR
        </button>
        <button
          type="button"
          className={`orderTicketSideBtn ${resource === "compute" ? "orderTicketSideBtn--active" : ""}`}
          onClick={() => onDraftChange({ ...draft, resource: "compute" })}
        >
          BUY GPU
        </button>
      </div>

      <div className="orderTicketQuotes">
        <div>
          <span>ENR</span>
          <strong>{fmtCurrency(node.energyPrice)}</strong>
        </div>
        <div>
          <span>GPU</span>
          <strong>${unitPriceForResource(node, "compute").toFixed(3)}</strong>
        </div>
        <div>
          <span>DEV</span>
          <strong>{(node.priceDeviationPct ?? 0).toFixed(1)}%</strong>
        </div>
        <div>
          <span>SUP</span>
          <strong>{Math.round(node.gpuSupply)}%</strong>
        </div>
      </div>

      <div className="orderTicketRow">
        <label>
          QTY ({resourceLabel(resource)})
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => onDraftChange(liveDraft)}
            inputMode="numeric"
          />
        </label>
        <div className="orderTicketPx">
          <span>PX</span>
          <strong>
            {resource === "energy" ? fmtCurrency(unitPrice) : `$${unitPrice.toFixed(4)}`}
          </strong>
        </div>
        <div className="orderTicketPx">
          <span>NOTIONAL</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
      </div>

      <div className="orderTicketActions">
        <button type="button" className="btn btnExec" onClick={() => onExecuteSimulated(liveDraft)}>
          MKT EXEC
        </button>
        <button
          type="button"
          className="btn btnChain"
          disabled={!canSubmitOnchain || onchainPending}
          onClick={() => onSubmitOnchain(liveDraft, unitPrice.toFixed(6))}
        >
          {canSubmitOnchain ? "CHAIN" : "NO WALLET"}
        </button>
      </div>
      <div className="orderTicketFoot">
        {resourceShort(resource)} · {venue} · est. ${total.toFixed(2)} USDC
      </div>
    </div>
  );
}
