import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MarketNode, MigrationArc } from "../lib/types";
import type { ResourceKind } from "../lib/marketplace";
import MapNodeMarker from "./MapNodeMarker";

type Props = {
  nodes: MarketNode[];
  crisis: boolean;
  migrationArcs: MigrationArc[];
  overloadedNodeId: string | null;
  onBuyIntent: (node: MarketNode, resource: ResourceKind) => void;
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

export default function WorldMap({ nodes, crisis, migrationArcs, overloadedNodeId, onBuyIntent }: Props) {
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
          const scoutHot =
            (n.scoutStatus ?? "normal") === "extreme" || (n.scoutStatus ?? "normal") === "expensive";
          const hot = (crisis && (overloaded || n.workloadsActive > 70)) || scoutHot;
          return (
            <MapNodeMarker
              key={n.id}
              node={n}
              hot={hot}
              overloaded={overloaded}
              crisis={crisis}
              onBuyIntent={onBuyIntent}
            />
          );
        })}
      </MapContainer>

      <div className="mapHint">Scroll to zoom · Hover cities to buy · Click for venue details</div>
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
