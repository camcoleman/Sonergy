import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MarketNode, MigrationArc } from "../lib/types";
import type { ResourceKind } from "../lib/marketplace";
import MapNodeMarker from "./MapNodeMarker";

type Props = {
  nodes: MarketNode[];
  crisis: boolean;
  migrationArcs: MigrationArc[];
  overloadedNodeId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (node: MarketNode | null) => void;
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

function MapBackgroundClick({ onClearSelection }: { onClearSelection: () => void }) {
  useMapEvents({
    click: () => onClearSelection(),
  });
  return null;
}

export default function WorldMap({
  nodes,
  crisis,
  migrationArcs,
  overloadedNodeId,
  selectedNodeId,
  onSelectNode,
  onBuyIntent,
}: Props) {
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const migrationLines = migrationArcs
    .map((arc) => {
      const ttl = arc.durationMs ?? 5000;
      if (Date.now() - arc.startedAt >= ttl) return null;
      const from = nodeById[arc.fromNodeId];
      const to = nodeById[arc.toNodeId];
      if (!from || !to) return null;
      return {
        id: arc.id,
        kind: arc.kind ?? "simulation",
        positions: [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ] as [number, number][],
      };
    })
    .filter(Boolean) as { id: string; kind: string; positions: [number, number][] }[];

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
        <MapBackgroundClick onClearSelection={() => onSelectNode(null)} />

        {migrationLines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{
              color: line.kind === "collection" ? "#28d69a" : "#6aa5ff",
              weight: line.kind === "collection" ? 5 : 3,
              opacity: line.kind === "collection" ? 0.95 : 0.85,
              dashArray: line.kind === "collection" ? "14 10" : "10 8",
              className: line.kind === "collection" ? "migrationArc migrationArc--collection" : "migrationArc",
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
              selected={selectedNodeId === n.id}
              onSelectNode={onSelectNode}
              onBuyIntent={onBuyIntent}
            />
          );
        })}
      </MapContainer>

      <div className="mapHint">CLICK VENUE TO TRADE · GREEN ARC = ENERGY COLLECTION MIGRATION</div>
      <div className="mapLegend">
        <span>
          <i className="legendDot legendDot--good" /> Stable
        </span>
        <span>
          <i className="legendDot legendDot--bad" /> Stress
        </span>
        <span>
          <i className="legendLine legendLine--collection" /> Collection arc
        </span>
      </div>
    </div>
  );
}
