import { Fragment, useEffect, useRef, type MouseEvent } from "react";
import L from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import type { MarketNode } from "../lib/types";
import { fmtCurrency, fmtSignedPct } from "../lib/utils";
import { gpuHourPrice, type ResourceKind } from "../lib/marketplace";

type Props = {
  node: MarketNode;
  hot: boolean;
  overloaded: boolean;
  crisis: boolean;
  selected: boolean;
  onSelectNode: (node: MarketNode) => void;
  onBuyIntent: (node: MarketNode, resource: ResourceKind) => void;
};

function createNodeIcon(node: MarketNode, hot: boolean, overloaded: boolean, selected: boolean) {
  const shortName = node.name.split(" ")[0];
  return L.divIcon({
    className: "sonergyLeafletIcon",
    html: `
      <div class="mapMarker ${hot ? "mapMarker--hot" : ""} ${overloaded ? "mapMarker--overload" : ""} ${selected ? "mapMarker--selected" : ""} mapMarker--interactive">
        <span class="mapMarkerDot"></span>
        <span class="mapMarkerLabel">${shortName}</span>
        ${overloaded ? '<span class="mapMarkerAlert">OVLD</span>' : ""}
      </div>
    `,
    iconSize: [96, 52],
    iconAnchor: [48, 26],
  });
}

export default function MapNodeMarker({
  node,
  hot,
  overloaded,
  crisis,
  selected,
  onSelectNode,
  onBuyIntent,
}: Props) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (selected) marker.openPopup();
    else marker.closePopup();
  }, [selected]);

  function handleBuy(resource: ResourceKind, e: MouseEvent) {
    e.stopPropagation();
    onSelectNode(node);
    onBuyIntent(node, resource);
  }

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
        ref={markerRef}
        position={[node.lat, node.lng]}
        icon={createNodeIcon(node, hot, overloaded && crisis, selected)}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectNode(node);
          },
        }}
      >
        <Popup className="mapPopup mapPopup--ticket" closeButton={false} autoPan={false}>
          <div className="mapTicket">
            <div className="mapTicketHead">
              <strong>{node.name.replace(" Node", "")}</strong>
              <span className="mapTicketTag">{node.regionTag}</span>
            </div>
            <div className="mapTicketGrid">
              <span>ENR {fmtCurrency(node.energyPrice)}</span>
              <span>GPU ${gpuHourPrice(node).toFixed(3)}</span>
              <span>DEV {fmtSignedPct(node.priceDeviationPct ?? 0, 1)}</span>
              <span>LOAD {Math.round(node.workloadsActive)}%</span>
            </div>
            <div className="mapTicketActions">
              <button type="button" className="mapBuyBtn mapBuyBtn--energy" onClick={(e) => handleBuy("energy", e)}>
                BUY ENR
              </button>
              <button type="button" className="mapBuyBtn mapBuyBtn--compute" onClick={(e) => handleBuy("compute", e)}>
                BUY GPU
              </button>
            </div>
          </div>
        </Popup>
      </Marker>
    </Fragment>
  );
}
