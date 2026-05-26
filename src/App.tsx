import React, { useEffect, useMemo, useRef, useState } from "react";

type MarketNode = {
  id: string;
  name: string;
  regionTag: string;
  energyPrice: number; // USD/kWh
  gpuSupply: number; // 0..100
  renewablePct: number; // 0..100
  carbonScore: number; // 0..100 lower is better
  workloadsActive: number; // 0..100 (demo intensity)
  efficiencyScore: number; // 0..100 higher is better
};

type Activity = {
  id: string;
  at: number;
  message: string;
  kind: "migration" | "purchase" | "market" | "grid" | "ethics";
};

type CrisisState = {
  active: boolean;
  untilMs: number; // wall clock
  severity: number; // 0..1 for tuning
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, places = 2) {
  const p = Math.pow(10, places);
  return Math.round(n * p) / p;
}

function fmtCurrency(n: number) {
  return `$${round(n, 2).toFixed(2)}/kWh`;
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function timeAgo(atMs: number, nowMs: number) {
  const s = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

const DEFAULT_NODES: MarketNode[] = [
  {
    id: "oregon-solar",
    name: "Oregon Solar Node",
    regionTag: "USA / NW",
    energyPrice: 0.08,
    gpuSupply: 82,
    renewablePct: 96,
    carbonScore: 8,
    workloadsActive: 62,
    efficiencyScore: 80,
  },
  {
    id: "texas-grid",
    name: "Texas Compute Farm",
    regionTag: "USA / TX",
    energyPrice: 0.05,
    gpuSupply: 68,
    renewablePct: 41,
    carbonScore: 32,
    workloadsActive: 49,
    efficiencyScore: 63,
  },
  {
    id: "tokyo-gpu",
    name: "Tokyo GPU Grid",
    regionTag: "JPN / Kanto",
    energyPrice: 0.11,
    gpuSupply: 74,
    renewablePct: 52,
    carbonScore: 27,
    workloadsActive: 55,
    efficiencyScore: 70,
  },
  {
    id: "iceland-green",
    name: "Iceland Green Cluster",
    regionTag: "ISL / Reykjavik",
    energyPrice: 0.07,
    gpuSupply: 54,
    renewablePct: 93,
    carbonScore: 10,
    workloadsActive: 44,
    efficiencyScore: 76,
  },
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function genMarketUpdate(nodes: MarketNode[], crisis: CrisisState): { next: MarketNode[]; event?: Activity } {
  const now = Date.now();
  const severity = crisis.active ? crisis.severity : 0;

  const updated = nodes.map((n) => {
    // Gentle baseline drift in normal mode, heavier perturbation in crisis mode.
    const priceDrift = (Math.random() * 0.04 - 0.02) * (1 + severity * 1.3);
    const renewableDrift = (Math.random() * 4 - 2) * (1 + severity * 1.2);
    const supplyDrift = (Math.random() * 10 - 5) * (1 + severity * 0.6);
    const workloadsDrift = (Math.random() * 10 - 5) * (1 + severity * 0.7);
    const efficiencyDrift = (Math.random() * 6 - 3) * (1 + severity * 0.5);

    let nextPrice = n.energyPrice + priceDrift;
    let nextRenew = n.renewablePct + renewableDrift;
    let nextSupply = n.gpuSupply + supplyDrift;
    let nextCarbon = n.carbonScore + (severity > 0 ? 3 + Math.random() * 6 : Math.random() * 2);
    let nextWorkloads = n.workloadsActive + workloadsDrift;
    let nextEfficiency = n.efficiencyScore + efficiencyDrift;

    if (crisis.active) {
      // Prices spike and greener supply can get temporarily throttled.
      const spike = 1.8 + severity * 0.55;
      nextPrice = n.energyPrice * spike + (Math.random() * 0.02);
      nextRenew = n.renewablePct - (10 + severity * 15) + (Math.random() * 4 - 2);
      nextCarbon = n.carbonScore + (8 + severity * 18) + (Math.random() * 6);
      nextSupply = n.gpuSupply + (Math.random() * 6 - 3) - severity * 8;
      nextWorkloads = n.workloadsActive + (8 + severity * 18) + (Math.random() * 10 - 5);
      nextEfficiency = n.efficiencyScore - (10 + severity * 18) + (Math.random() * 6 - 3);
    }

    nextPrice = clamp(nextPrice, 0.03, 0.38);
    nextRenew = clamp(nextRenew, 5, 100);
    nextSupply = clamp(nextSupply, 8, 100);
    nextCarbon = clamp(nextCarbon, 4, 99);
    nextWorkloads = clamp(nextWorkloads, 0, 100);
    nextEfficiency = clamp(nextEfficiency, 15, 100);

    return {
      ...n,
      energyPrice: round(nextPrice, 3),
      renewablePct: round(nextRenew, 1),
      gpuSupply: round(nextSupply, 1),
      carbonScore: Math.round(nextCarbon),
      workloadsActive: round(nextWorkloads, 1),
      efficiencyScore: Math.round(nextEfficiency),
    };
  });

  // Add a small chance of a visible market spike event in normal mode.
  if (!crisis.active && Math.random() < 0.12) {
    const deltaPct = Math.round(6 + Math.random() * 15);
    const target = pick(updated);
    return {
      next: updated,
      event: {
        id: uid("evt"),
        at: now,
        kind: "market",
        message: `Energy prices increased ${deltaPct}% on ${target.name.split(" ")[0]} due to AI demand.`,
      },
    };
  }

  return { next: updated };
}

function genCrisisBurst(updatedNodes: MarketNode[]): Activity[] {
  const now = Date.now();
  const agents = ["ResearchAgent", "TradingAgent", "LoadBalancerAgent", "CarbonAwareAgent"];
  const agentIds = [12, 7, 3, 18, 5, 9];
  const kinds: Activity["kind"][] = ["migration", "purchase", "purchase", "market", "grid", "ethics"];

  const getCheapest = () => {
    const sorted = [...updatedNodes].sort((a, b) => a.energyPrice - b.energyPrice);
    return sorted[0];
  };
  const getGreenest = () => {
    const sorted = [...updatedNodes].sort((a, b) => b.renewablePct - a.renewablePct);
    return sorted[0];
  };
  const getMostOverloaded = () => {
    const sorted = [...updatedNodes].sort((a, b) => b.gpuSupply - a.gpuSupply);
    return sorted[0];
  };

  const cheapest = getCheapest();
  const green = getGreenest();
  const overloaded = getMostOverloaded();

  const deltaPrice = Math.round(18 + Math.random() * 34);
  const migrationAgent = `${pick(agents)}_${pick(agentIds)}`;
  const tradingAgent = `${pick(agents)}_${pick(agentIds)}`;

  const activities: Activity[] = [
    {
      id: uid("evt"),
      at: now,
      kind: "grid",
      message: `Grid overload detected near ${overloaded.name.split(" ")[0]} — capacity is being strained.`,
    },
    {
      id: uid("evt"),
      at: now + 20,
      kind: "market",
      message: `Energy prices spiked ${deltaPrice}% during the grid crisis.`,
    },
    {
      id: uid("evt"),
      at: now + 40,
      kind: "purchase",
      message: `${tradingAgent} purchased 40 GPU hours from ${cheapest.name} to secure compute.`,
    },
    {
      id: uid("evt"),
      at: now + 60,
      kind: "migration",
      message: `${migrationAgent} migrated workloads to ${green.name.split(" ")[0]} due to lower carbon costs.`,
    },
    {
      id: uid("evt"),
      at: now + 80,
      kind: "ethics",
      message: `Humans are becoming priced out of critical energy as autonomous bidding accelerates.`,
    },
  ];

  // Fill up to 6 items for visual richness.
  while (activities.length < 6) {
    const kind = pick(kinds);
    const node = pick(updatedNodes);
    if (kind === "purchase") {
      activities.push({
        id: uid("evt"),
        at: now + activities.length * 20,
        kind: "purchase",
        message: `${pick(agents)}_${pick(agentIds)} purchased 8 GPU hours from ${node.name.split(" ")[0]}.`,
      });
    } else if (kind === "migration") {
      activities.push({
        id: uid("evt"),
        at: now + activities.length * 20,
        kind: "migration",
        message: `${pick(agents)}_${pick(agentIds)} rerouted jobs to ${node.name.split(" ")[0]} for availability.`,
      });
    } else if (kind === "grid") {
      activities.push({
        id: uid("evt"),
        at: now + activities.length * 20,
        kind: "grid",
        message: `Warning banner: ${node.name.split(" ")[0]} regional grid overload.`,
      });
    } else if (kind === "market") {
      activities.push({
        id: uid("evt"),
        at: now + activities.length * 20,
        kind: "market",
        message: `Micro-market: ${node.name.split(" ")[0]} price volatility increased.`,
      });
    }
  }

  return activities;
}

export default function App() {
  const [nodes, setNodes] = useState<MarketNode[]>(DEFAULT_NODES);
  const [activity, setActivity] = useState<Activity[]>(() => {
    const now = Date.now();
    return [
      {
        id: uid("evt"),
        at: now - 35_000,
        kind: "migration",
        message: "ResearchAgent_12 migrated workloads to Iceland due to lower carbon costs.",
      },
      {
        id: uid("evt"),
        at: now - 20_000,
        kind: "purchase",
        message: "TradingAgent_7 purchased 40 GPU hours from Oregon Solar Node.",
      },
      {
        id: uid("evt"),
        at: now - 9_000,
        kind: "market",
        message: "Energy prices increased 18% due to AI demand spike.",
      },
    ];
  });

  const [crisis, setCrisis] = useState<CrisisState>({
    active: false,
    untilMs: 0,
    severity: 0.8,
  });

  const [durationSec, setDurationSec] = useState<number>(20);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const crisisRef = useRef(crisis);
  crisisRef.current = crisis;

  const systemHealth = useMemo(() => {
    if (crisis.active) return { label: "Grid Overload", tone: "bad" as const, dot: "bad" as const };
    // Simple heuristic based on renewable and price.
    const avgRenew = nodes.reduce((a, n) => a + n.renewablePct, 0) / nodes.length;
    const avgPrice = nodes.reduce((a, n) => a + n.energyPrice, 0) / nodes.length;
    if (avgRenew < 45 || avgPrice > 0.1) return { label: "Elevated Load", tone: "warn" as const, dot: "warn" as const };
    return { label: "Healthy", tone: "good" as const, dot: "good" as const };
  }, [crisis.active, nodes]);

  const stats = useMemo(() => {
    const avgEnergy = nodes.reduce((a, n) => a + n.energyPrice, 0) / nodes.length;
    const avgRenew = nodes.reduce((a, n) => a + n.renewablePct, 0) / nodes.length;
    const avgCarbon = nodes.reduce((a, n) => a + n.carbonScore, 0) / nodes.length;
    const avgEfficiency = nodes.reduce((a, n) => a + n.efficiencyScore, 0) / nodes.length;
    return {
      avgEnergy,
      avgRenew,
      avgCarbon,
      avgEfficiency,
    };
  }, [nodes]);

  // Main live loop: market drift + crisis burst.
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
      setNodes((prev) => {
        const crisisNow = crisisRef.current;
        const { next, event } = genMarketUpdate(prev, crisisNow);

        if (event) {
          setActivity((a) => [event, ...a].slice(0, 18));
        }

        if (crisisNow.active) {
          // Time-based end handled below, but crisis bursts happen opportunistically here.
          if (Math.random() < 0.45) {
            const burst = genCrisisBurst(next);
            setActivity((a) => [...burst, ...a].slice(0, 18));
          }
        }

        return next;
      });
    }, 1500);

    return () => window.clearInterval(tick);
  }, []);

  // Crisis lifecycle + expiration.
  useEffect(() => {
    if (!crisis.active) return;
    const t = window.setInterval(() => {
      if (Date.now() > crisisRef.current.untilMs) {
        setCrisis((c) => ({ ...c, active: false, untilMs: 0 }));
        setActivity((a) => [
          {
            id: uid("evt"),
            at: Date.now(),
            kind: "market",
            message: "Crisis ended. Agents throttled bids and the market stabilized.",
          },
          ...a,
        ]);
      }
    }, 250);

    return () => window.clearInterval(t);
  }, [crisis.active]);

  function triggerCrisis() {
    setActivity((a) => [
      {
        id: uid("evt"),
        at: Date.now(),
        kind: "grid",
        message: "Trigger Grid Crisis: autonomous bidding begins to outpace regional supply.",
      },
      ...a,
    ]);
    setCrisis({
      active: true,
      untilMs: Date.now() + durationSec * 1000,
      severity: 0.85,
    });
  }

  function clearCrisis() {
    setCrisis((c) => ({ ...c, active: false, untilMs: 0 }));
    setActivity((a) => [
      {
        id: uid("evt"),
        at: Date.now(),
        kind: "market",
        message: "Crisis cleared manually. Agents paused aggressive purchasing.",
      },
      ...a,
    ]);
  }

  const crisisSecondsLeft = crisis.active ? Math.max(0, Math.ceil((crisis.untilMs - nowMs) / 1000)) : 0;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="logoMark" aria-hidden="true" />
          <div>Sonergy</div>
        </div>

        <div className="topbarSpacer" />

        <div className="pill" aria-label="System health">
          <span className={`dot ${systemHealth.dot} ${crisis.active ? "blink" : ""}`} />
          <span>
            System: <strong style={{ color: "rgba(230,238,252,0.98)" }}>{systemHealth.label}</strong>
          </span>
        </div>
      </div>

      {crisis.active ? (
        <div className="bannerRow">
          <div className="banner">
            <div className={`gridWarnGlyph ${crisis.active ? "blink" : ""}`}>!</div>
            <div>
              <strong>Grid overload</strong> — red alert: prices are spiking and agents are aggressively buying
              compute/energy.
            </div>
            <div style={{ marginLeft: "auto", color: "rgba(230,238,252,0.9)", fontWeight: 800 }}>
              {crisisSecondsLeft}s
            </div>
          </div>
        </div>
      ) : null}

      <div className="content">
        <section className="panel" aria-label="Live market">
          <div className="panelHeader">
            <h2>Live Resource Marketplace</h2>
            <div className="pill" style={{ padding: "6px 10px" }}>
              <span className="dot" style={{ background: "var(--accent)" }} />
              <span>Realtime mock</span>
            </div>
          </div>
          <div className="panelBody">
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Energy Cost</th>
                    <th>GPU Supply</th>
                    <th>Renewable %</th>
                    <th>Active Workloads</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <div className="nodeName">
                          <span>{n.name.replace(" Node", "")}</span>
                          <span>{n.regionTag}</span>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtCurrency(n.energyPrice)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 78 }}>
                            <div className="bar" aria-hidden="true" style={{ marginTop: 0 }}>
                              <i style={{ width: `${clamp(n.gpuSupply, 0, 100)}%` }} />
                            </div>
                          </div>
                          <div style={{ fontWeight: 800 }}>{Math.round(n.gpuSupply)}</div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtPct(n.renewablePct)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 78 }}>
                            <div className="bar" aria-hidden="true" style={{ marginTop: 0 }}>
                              <i
                                style={{
                                  width: `${clamp(n.workloadsActive, 0, 100)}%`,
                                  background: "linear-gradient(90deg, rgba(106,165,255,0.95), rgba(255,204,102,0.95))",
                                }}
                              />
                            </div>
                          </div>
                          <div style={{ fontWeight: 800 }}>{Math.round(n.workloadsActive)}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="metricsRow">
              <div className="metricCard">
                <div className="label">Avg energy cost</div>
                <div className="value">{fmtCurrency(stats.avgEnergy).replace("/kWh", "")}</div>
              </div>
              <div className="metricCard">
                <div className="label">Renewables availability</div>
                <div className="value">{Math.round(stats.avgRenew)}%</div>
              </div>
              <div className="metricCard">
                <div className="label">Energy efficiency</div>
                <div className="value">{Math.round(stats.avgEfficiency)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" aria-label="Global infrastructure">
          <div className="panelHeader">
            <h2>Global Infrastructure Dashboard</h2>
            <div className="pill" style={{ padding: "6px 10px" }}>
              <span className={`dot ${crisis.active ? "bad" : ""} ${crisis.active ? "blink" : ""}`} />
              <span>{crisis.active ? "Crisis mode" : "Steady state"}</span>
            </div>
          </div>
          <div className="panelBody">
            <div className="cardsGrid">
              {nodes.map((n, idx) => (
                <div
                  className="mapCard"
                  key={n.id}
                  style={{
                    outline: crisis.active && idx === 0 ? "1px solid rgba(255,77,90,0.25)" : "none",
                    animation: crisis.active ? "none" : undefined,
                  }}
                >
                  <div className="mapCardTop">
                    <h3>{n.name.replace(" Node", "").replace(" Grid", " Grid")}</h3>
                    <div className="pill" style={{ padding: "6px 10px" }}>
                      <span className={`dot ${n.renewablePct > 75 ? "good" : n.renewablePct > 45 ? "warn" : "bad"}`} />
                      <span>{Math.round(n.renewablePct)}%</span>
                    </div>
                  </div>
                  <div className="sub">
                    Carbon score: <strong>{n.carbonScore}</strong> (lower is better)
                  </div>
                  <div className="tagRow">
                    <div className="tag">Energy: {fmtCurrency(n.energyPrice)}</div>
                    <div className="tag">GPU supply: {Math.round(n.gpuSupply)}/100</div>
                    <div className="tag">Active workloads: {Math.round(n.workloadsActive)}</div>
                    <div className="tag">Efficiency score: {Math.round(n.efficiencyScore)}</div>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${clamp(n.renewablePct, 0, 100)}%`, background: "linear-gradient(90deg, rgba(255,204,102,0.95), rgba(47,227,166,0.95))" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel" aria-label="Autonomous AI agent activity feed">
          <div className="panelHeader">
            <h2>Autonomous AI Agent Feed</h2>
            <div className="pill" style={{ padding: "6px 10px" }}>
              <span className="dot" style={{ background: "rgba(106,165,255,0.95)" }} />
              <span>{activity.length} events</span>
            </div>
          </div>
          <div className="panelBody">
            <div className="feed">
              {crisis.active ? <div className="humanOut">Humans become priced out of critical infrastructure while agents optimize for bids.</div> : null}
              {activity.length === 0 ? <div className="feedEmpty">No activity yet.</div> : null}
              {activity.slice(0, 10).map((e) => (
                <div className="feedItem" key={e.id}>
                  <div className="time">{timeAgo(e.at, nowMs)}</div>
                  <div className="msg">{e.message}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="bottomBar">
        <div className="bottomGrid">
          <div className="controlsLeft">
            <div>
              <div className="controlLabel">Crisis duration</div>
              <select value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} disabled={crisis.active}>
                <option value={10}>10s</option>
                <option value={20}>20s</option>
                <option value={35}>35s</option>
                <option value={50}>50s</option>
              </select>
            </div>

            <button className={`btn btnPrimary ${crisis.active ? "blink" : ""}`} onClick={triggerCrisis} disabled={crisis.active}>
              Trigger Grid Crisis
            </button>

            <button className="btn" onClick={clearCrisis} disabled={!crisis.active}>
              Clear Crisis
            </button>
          </div>

          <div className="priceImpact">
            <div className="title">Sustainability Optimization</div>
            <div className="sub">
              Carbon score avg: <strong>{Math.round(stats.avgCarbon)}</strong> • Renewables avg:{" "}
              <strong>{Math.round(stats.avgRenew)}%</strong> • Efficiency avg: <strong>{Math.round(stats.avgEfficiency)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

