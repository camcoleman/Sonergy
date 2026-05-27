import type { CollectedAsset } from "../lib/types";
import { shortAccessKey } from "../lib/collection";

type Props = {
  assets: CollectedAsset[];
};

export default function CollectedAssetsPanel({ assets }: Props) {
  return (
    <div className="collectedPanel">
      <div className="collectedPanelHeader">
        <strong>COLLECTED ASSET KEYS</strong>
        <span className="muted">{assets.length} active</span>
      </div>

      {assets.length === 0 ? (
        <div className="onchainHint">No on-chain collections yet. Fill an order to mint access keys or migration bundles.</div>
      ) : (
        <div className="collectedList">
          {assets.map((a) => (
            <div key={a.id} className={`collectedRow collectedRow--${a.resourceType}`}>
              <div className="collectedRowTop">
                <span className={`collectedType collectedType--${a.resourceType}`}>
                  {a.resourceType === "compute" ? "COMPUTE" : "ENERGY"}
                </span>
                <span className="muted">#{a.orderId}</span>
              </div>
              <div className="collectedVenue">{a.venueLabel}</div>
              <div className="collectedMeta">
                <span>
                  LEASE <strong>{a.leaseHoursRemaining}h</strong>
                </span>
                <span>
                  PLANT <strong>{a.allocationNodeId}</strong>
                </span>
              </div>
              <code className="collectedKey" title={a.accessKey}>
                {shortAccessKey(a.accessKey)}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
