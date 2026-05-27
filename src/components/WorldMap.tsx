import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MarketNode, MigrationArc } from "../lib/types";
import { fmtCurrency } from "../lib/utils";

type Props = {
  nodes: MarketNode[];
  crisis: boolean;
  migrationArcs: MigrationArc[];
  overloadedNodeId: string | null;
};

function FitNodeBounds({ nodes }: { nodes: MarketNode[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || nodes.length === 0) return;
    fitted.current = true;
    const bounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.45), { animate: false });
  }, [map, nodes]);

  return null;
}

function createNodeIcon(node: MarketNode, hot: boolean, overloaded: boolean) {
  const shortName = node.name.split(" ")[0];
  return L.divIcon({
    className: "sonergyLeafletIcon",
    html: `
      <div class="mapMarker ${hot ? "mapMarker--hot" : ""} ${overloaded ? "mapMarker--overload" : ""}">
        <span class="mapMarkerDot"></span>
        <span class="mapMarkerLabel">${shortName}</span>
        ${overloaded ? '<span class="mapMarkerAlert">OVERLOAD</span>' : ""}
      </div>
    `,
    iconSize: [96, 52],
    iconAnchor: [48, 26],
  });
}

export default function WorldMap({ nodes, crisis, migrationArcs, overloadedNodeId }: Props) {
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const recentArcs = migrationArcs.filter((a) => Date.now() - a.startedAt < 5000);

  const migrationLines = recentArcs
    .map((arc) => {
      const from = nodeById[arc.fromNodeId];
      const to = nodeById[arc.toNodeId];
      if (!from || !to) return null;
      return {
        id: arc.id,
        positions: [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ] as [number, number][],
      };
    })
    .filter(Boolean) as { id: string; positions: [number, number][] }[];

  return (
    <div className={`worldMapWrap ${crisis ? "worldMapWrap--crisis" : ""}`}>
      <MapContainer
        className="leafletMap"
        center={[45, -20]}
        zoom={3}
        minZoom={2}
        maxZoom={12}
        scrollWheelZoom
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitNodeBounds nodes={nodes} />

        {migrationLines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{
              color: "#6aa5ff",
              weight: 3,
              opacity: 0.85,
              dashArray: "10 8",
            }}
          />
        ))}

        {nodes.map((n) => {
          const overloaded = overloadedNodeId === n.id;
          const scoutHot = (n.scoutStatus ?? "normal") === "extreme" || (n.scoutStatus ?? "normal") === "expensive";
          const hot = (crisis && (overloaded || n.workloadsActive > 70)) || scoutHot;
          return (
            <Fragment key={n.id}>
              {hot ? (
                <Circle
                  center={[n.lat, n.lng]}
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
              <Marker position={[n.lat, n.lng]} icon={createNodeIcon(n, hot, overloaded && crisis)}>
                <Popup className="mapPopup">
                  <strong>{n.name}</strong>
                  <div>{n.regionTag}</div>
                  <ul>
                    <li>Energy: {fmtCurrency(n.energyPrice)}</li>
                    <li>GPU supply: {Math.round(n.gpuSupply)}%</li>
                    <li>Renewable: {Math.round(n.renewablePct)}%</li>
                    <li>Carbon score: {n.carbonScore}</li>
                    <li>Active workloads: {Math.round(n.workloadsActive)}</li>
                    <li>Baseline: ${(n.priceBaseline ?? n.energyPrice).toFixed(3)}</li>
                    <li>Deviation: {(n.priceDeviationPct ?? 0).toFixed(1)}%</li>
                  </ul>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>

      <div className="mapHint">Scroll to zoom · Drag to pan · Click nodes for details</div>
      <div className="mapLegend">
        <span>
          <i className="legendDot legendDot--good" /> Stable node
        </span>
        <span>
          <i className="legendDot legendDot--bad" /> Crisis / overload
        </span>
        <span>
          <i className="legendLine" /> Agent migration
        </span>
      </div>
    </div>
  );
}
