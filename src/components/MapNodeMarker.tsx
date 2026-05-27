import { Fragment, useRef, useState } from "react";
import L from "leaflet";
import { Circle, Marker, Popup, Tooltip } from "react-leaflet";
import type { MarketNode } from "../lib/types";
import { fmtCurrency, fmtSignedPct } from "../lib/utils";
import { gpuHourPrice, type ResourceKind } from "../lib/marketplace";

type Props = {
  node: MarketNode;
  hot: boolean;
  overloaded: boolean;
  crisis: boolean;
  onBuyIntent: (node: MarketNode, resource: ResourceKind) => void;
};

function createNodeIcon(node: MarketNode, hot: boolean, overloaded: boolean) {
  const shortName = node.name.split(" ")[0];
  return L.divIcon({
    className: "sonergyLeafletIcon",
    html: `
      <div class="mapMarker ${hot ? "mapMarker--hot" : ""} ${overloaded ? "mapMarker--overload" : ""} mapMarker--interactive">
        <span class="mapMarkerDot"></span>
        <span class="mapMarkerLabel">${shortName}</span>
        ${overloaded ? '<span class="mapMarkerAlert">OVERLOAD</span>' : ""}
      </div>
    `,
    iconSize: [96, 52],
    iconAnchor: [48, 26],
  });
}

export default function MapNodeMarker({ node, hot, overloaded, crisis, onBuyIntent }: Props) {
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<number>();

  const showMenu = () => {
    window.clearTimeout(hideTimer.current);
    setHovered(true);
  };

  const hideMenu = () => {
    hideTimer.current = window.setTimeout(() => setHovered(false), 120);
  };

  return (
    <Fragment>
      {hot ? (
        <Circle
          center={[node.lat, node.lng]}
          radius={crisis ? 650_000 : 400_000}
          pathOptions={{
            color: "#ff4d5a",
            fillColor: "#ff4d5a",
            fillOpacity: 0.12,
            weight: 1,
            className: "mapPulseCircle",
          }}
        />
      ) : null}
      <Marker
        position={[node.lat, node.lng]}
        icon={createNodeIcon(node, hot, overloaded && crisis)}
        eventHandlers={{
          mouseover: showMenu,
          mouseout: hideMenu,
        }}
      >
        <Tooltip
          permanent={hovered}
          interactive
          direction="top"
          offset={[0, -34]}
          className="mapBuyTooltip"
          opacity={1}
        >
          <div className="mapBuyMenu" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
            <div className="mapBuyMenuTitle">{node.name.replace(" Node", "")}</div>
            <div className="mapBuyMenuPrices">
              <span>{fmtCurrency(node.energyPrice)}</span>
              <span>${gpuHourPrice(node).toFixed(2)}/GPU-hr</span>
            </div>
            <div className="mapBuyMenuActions">
              <button type="button" className="mapBuyBtn mapBuyBtn--energy" onClick={() => onBuyIntent(node, "energy")}>
                Buy energy
              </button>
              <button type="button" className="mapBuyBtn mapBuyBtn--compute" onClick={() => onBuyIntent(node, "compute")}>
                Buy compute
              </button>
            </div>
          </div>
        </Tooltip>
        <Popup className="mapPopup">
          <strong>{node.name}</strong>
          <div>{node.regionTag}</div>
          <ul>
            <li>Energy: {fmtCurrency(node.energyPrice)}</li>
            <li>Compute: ${gpuHourPrice(node).toFixed(3)}/GPU-hr</li>
            <li>GPU supply: {Math.round(node.gpuSupply)}%</li>
            <li>Renewable: {Math.round(node.renewablePct)}%</li>
            <li>Carbon score: {node.carbonScore}</li>
            <li>Active workloads: {Math.round(node.workloadsActive)}</li>
            <li>Baseline: ${(node.priceBaseline ?? node.energyPrice).toFixed(3)}</li>
            <li>Deviation: {fmtSignedPct(node.priceDeviationPct ?? 0, 1)}</li>
          </ul>
          <div className="mapPopupBuy">
            <button type="button" className="mapBuyBtn mapBuyBtn--energy" onClick={() => onBuyIntent(node, "energy")}>
              Buy energy
            </button>
            <button type="button" className="mapBuyBtn mapBuyBtn--compute" onClick={() => onBuyIntent(node, "compute")}>
              Buy compute
            </button>
          </div>
        </Popup>
      </Marker>
    </Fragment>
  );
}
