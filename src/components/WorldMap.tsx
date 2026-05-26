import type { MarketNode, MigrationArc } from "../lib/types";

type Props = {
  nodes: MarketNode[];
  crisis: boolean;
  migrationArcs: MigrationArc[];
  overloadedNodeId: string | null;
};

const CONTINENTS = [
  "M8 28 C12 22, 28 18, 38 22 C48 26, 52 32, 48 38 C42 44, 28 46, 18 42 C10 38, 6 34, 8 28 Z",
  "M52 30 C58 24, 72 22, 82 26 C90 30, 92 36, 86 40 C78 44, 62 42, 54 38 C50 34, 50 32, 52 30 Z",
  "M44 14 C50 10, 58 12, 60 18 C58 24, 50 26, 44 22 C42 18, 42 16, 44 14 Z",
];

export default function WorldMap({ nodes, crisis, migrationArcs, overloadedNodeId }: Props) {
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const recentArcs = migrationArcs.filter((a) => Date.now() - a.startedAt < 4000);

  return (
    <div className={`worldMapWrap ${crisis ? "worldMapWrap--crisis" : ""}`}>
      <svg viewBox="0 0 100 50" className="worldMap" role="img" aria-label="Global infrastructure map">
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(106,165,255,0.12)" />
            <stop offset="100%" stopColor="rgba(106,165,255,0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="100" height="50" fill="url(#mapGlow)" />
        <path d="M0 0 H100 V50 H0 Z" fill="rgba(8,14,28,0.5)" />

        {CONTINENTS.map((d, i) => (
          <path
            key={i}
            d={d}
            className="continent"
            fill={crisis ? "rgba(60,28,36,0.55)" : "rgba(22,38,72,0.75)"}
            stroke={crisis ? "rgba(255,77,90,0.25)" : "rgba(90,115,173,0.35)"}
            strokeWidth="0.35"
          />
        ))}

        {recentArcs.map((arc) => {
          const from = nodeById[arc.fromNodeId];
          const to = nodeById[arc.toNodeId];
          if (!from || !to) return null;
          return (
            <line
              key={arc.id}
              x1={from.mapX}
              y1={from.mapY}
              x2={to.mapX}
              y2={to.mapY}
              className="migrationArc"
            />
          );
        })}

        {nodes.map((n) => {
          const overloaded = overloadedNodeId === n.id;
          const hot = crisis && (overloaded || n.workloadsActive > 70);
          return (
            <g key={n.id} className="mapNodeGroup">
              {hot ? <circle cx={n.mapX} cy={n.mapY} r="4.5" className="mapNodePulse" /> : null}
              <circle
                cx={n.mapX}
                cy={n.mapY}
                r="2.2"
                className={`mapNode ${hot ? "mapNode--hot" : ""}`}
              />
              <text x={n.mapX} y={n.mapY - 3.5} className="mapNodeLabel" textAnchor="middle">
                {n.name.split(" ")[0]}
              </text>
              {overloaded && crisis ? (
                <text x={n.mapX} y={n.mapY + 5.5} className="mapOverloadLabel" textAnchor="middle">
                  OVERLOAD
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mapLegend">
        <span>
          <i className="legendDot legendDot--good" /> Stable
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
