import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import AllocationMeters from "./components/AllocationMeters";
import OnchainMarketplace from "./components/OnchainMarketplace";
import WorldMap from "./components/WorldMap";
import {
  cloneDefaultNodes,
  CRISIS_AGENT_ALLOCATION,
  CRISIS_HUMAN_ALLOCATION,
  seedActivity,
  STEADY_AGENT_ALLOCATION,
  STEADY_HUMAN_ALLOCATION,
} from "./lib/data";
import { genCrisisBurst, genMarketUpdate } from "./lib/simulation";
import type { Activity, CrisisState, MarketNode, MigrationArc } from "./lib/types";
import { ACTIVITY_PRIORITY, clamp, fmtCurrency, fmtPct, timeAgo, uid } from "./lib/utils";
import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS } from "./web3/chains";

export default function App() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const supportedChainIds = useMemo(() => SUPPORTED_CHAINS.map((c) => c.id), []);
  const isSupportedChain = supportedChainIds.includes(chainId);
  const targetChainName = useMemo(
    () => SUPPORTED_CHAINS.find((c) => c.id === DEFAULT_CHAIN_ID)?.name ?? "Supported testnet",
    [],
  );

  const [nodes, setNodes] = useState<MarketNode[]>(cloneDefaultNodes);
  const [activity, setActivity] = useState<Activity[]>(seedActivity);
  const [onchainActivity, setOnchainActivity] = useState<Activity[]>([]);
  const [crisis, setCrisis] = useState<CrisisState>({
    active: false,
    untilMs: 0,
    severity: 0.85,
  });
  const [durationSec, setDurationSec] = useState(20);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [humanAllocation, setHumanAllocation] = useState(STEADY_HUMAN_ALLOCATION);
  const [agentAllocation, setAgentAllocation] = useState(STEADY_AGENT_ALLOCATION);
  const [migrationArcs, setMigrationArcs] = useState<MigrationArc[]>([]);

  const crisisRef = useRef(crisis);
  crisisRef.current = crisis;

  const pushMigrationArc = useCallback((fromNodeId?: string, toNodeId?: string) => {
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) return;
    const arc: MigrationArc = {
      id: uid("arc"),
      fromNodeId,
      toNodeId,
      startedAt: Date.now(),
    };
    setMigrationArcs((prev) => [arc, ...prev].slice(0, 6));
  }, []);

  const resetDemo = useCallback(() => {
    setNodes(cloneDefaultNodes());
    setActivity(seedActivity());
    setCrisis({ active: false, untilMs: 0, severity: 0.85 });
    setHumanAllocation(STEADY_HUMAN_ALLOCATION);
    setAgentAllocation(STEADY_AGENT_ALLOCATION);
    setMigrationArcs([]);
    setNowMs(Date.now());
  }, []);

  const systemHealth = useMemo(() => {
    if (crisis.active) return { label: "Grid Overload", dot: "bad" as const };
    const avgRenew = nodes.reduce((a, n) => a + n.renewablePct, 0) / nodes.length;
    const avgPrice = nodes.reduce((a, n) => a + n.energyPrice, 0) / nodes.length;
    if (avgRenew < 45 || avgPrice > 0.1) return { label: "Elevated Load", dot: "warn" as const };
    return { label: "Healthy", dot: "good" as const };
  }, [crisis.active, nodes]);

  const stats = useMemo(() => {
    const avgEnergy = nodes.reduce((a, n) => a + n.energyPrice, 0) / nodes.length;
    const avgRenew = nodes.reduce((a, n) => a + n.renewablePct, 0) / nodes.length;
    const avgCarbon = nodes.reduce((a, n) => a + n.carbonScore, 0) / nodes.length;
    const avgEfficiency = nodes.reduce((a, n) => a + n.efficiencyScore, 0) / nodes.length;
    return { avgEnergy, avgRenew, avgCarbon, avgEfficiency };
  }, [nodes]);

  const overloadedNodeId = useMemo(() => {
    if (!crisis.active) return null;
    const sorted = [...nodes].sort((a, b) => b.workloadsActive - a.workloadsActive);
    return sorted[0]?.id ?? null;
  }, [crisis.active, nodes]);

  const sortedActivity = useMemo(() => {
    const merged = [...onchainActivity, ...activity];
    return merged.sort((a, b) => {
      if (crisis.active) {
        const p = ACTIVITY_PRIORITY[a.kind] - ACTIVITY_PRIORITY[b.kind];
        if (p !== 0) return p;
      }
      return b.at - a.at;
    });
  }, [activity, onchainActivity, crisis.active]);

  const onNewOnchainActivity = useCallback((a: Activity) => {
    setOnchainActivity((prev) => [a, ...prev].slice(0, 18));
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
      setNodes((prev) => {
        const crisisNow = crisisRef.current;
        const { next, event } = genMarketUpdate(prev, crisisNow);

        if (event) {
          setActivity((a) => [event, ...a].slice(0, 24));
        }

        if (crisisNow.active && Math.random() < 0.4) {
          const burst = genCrisisBurst(next);
          burst.forEach((e) => pushMigrationArc(e.fromNodeId, e.toNodeId));
          setActivity((a) => [...burst, ...a].slice(0, 24));
        }

        return next;
      });
    }, 1500);
    return () => window.clearInterval(tick);
  }, [pushMigrationArc]);

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

  useEffect(() => {
    const targetHuman = crisis.active ? CRISIS_HUMAN_ALLOCATION : STEADY_HUMAN_ALLOCATION;
    const targetAgent = crisis.active ? CRISIS_AGENT_ALLOCATION : STEADY_AGENT_ALLOCATION;
    const t = window.setInterval(() => {
      setHumanAllocation((h) => {
        const next = h + (targetHuman - h) * 0.18;
        return Math.abs(next - targetHuman) < 0.5 ? targetHuman : next;
      });
      setAgentAllocation((a) => {
        const next = a + (targetAgent - a) * 0.18;
        return Math.abs(next - targetAgent) < 0.5 ? targetAgent : next;
      });
    }, 400);
    return () => window.clearInterval(t);
  }, [crisis.active]);

  useEffect(() => {
    const prune = window.setInterval(() => {
      setMigrationArcs((arcs) => arcs.filter((a) => Date.now() - a.startedAt < 5000));
    }, 1000);
    return () => window.clearInterval(prune);
  }, []);

  function triggerCrisis() {
    setActivity((a) => [
      {
        id: uid("evt"),
        at: Date.now(),
        kind: "grid",
        message: "Trigger Grid Crisis: autonomous bidding begins to outpace regional supply.",
      },
      {
        id: uid("evt"),
        at: Date.now() + 1,
        kind: "ethics",
        message: "Human access throttled — critical infrastructure redirected to highest bidders.",
      },
      ...a,
    ]);
    setCrisis({
      active: true,
      untilMs: Date.now() + durationSec * 1000,
      severity: 0.85,
    });
    pushMigrationArc("texas-grid", "iceland-green");
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
    <div className={`app ${crisis.active ? "app--crisis" : ""}`}>
      <div className="topbar">
        <div className="brand">
          <div className="logoMark" aria-hidden="true" />
          <div>Sonergy</div>
        </div>
        <div className="topbarSpacer" />
        <div className="walletSlot">
          <ConnectButton />
        </div>
        <button type="button" className="btn btnGhost" onClick={resetDemo}>
          Reset demo
        </button>
        <div className="pill" aria-label="System health">
          <span className={`dot ${systemHealth.dot} ${crisis.active ? "blink" : ""}`} />
          <span>
            System: <strong>{systemHealth.label}</strong>
          </span>
        </div>
      </div>

      {isConnected && !isSupportedChain ? (
        <div className="bannerRow">
          <div className="banner banner--human">
            <div className="gridWarnGlyph">⚠</div>
            <div>
              <strong>Wrong network</strong> — switch to <strong>{targetChainName}</strong> to use the on-chain marketplace.
            </div>
          </div>
        </div>
      ) : null}

      {crisis.active ? (
        <div className="bannerRow bannerRow--stack">
          <div className="banner">
            <div className="gridWarnGlyph blink">!</div>
            <div>
              <strong>Grid overload</strong> — prices are spiking and agents are aggressively buying compute and energy.
            </div>
            <div className="bannerTimer">{crisisSecondsLeft}s</div>
          </div>
          <div className="banner banner--human">
            <div className="gridWarnGlyph">⚠</div>
            <div>
              <strong>Human access throttled</strong> — residential and non-agent workloads deprioritized during autonomous bidding.
            </div>
          </div>
        </div>
      ) : null}

      <div className="content">
        <section className="panel humanFacing" aria-label="Live market">
          <div className="panelHeader">
            <h2>Markets</h2>
            <div className="pill pillCompact">
              <span className="dot dotAccent" />
              <span>SIM + ON-CHAIN</span>
            </div>
          </div>
          <div className="panelBody">
            <OnchainMarketplace
              nodes={nodes.map((n) => ({ id: n.id, name: n.name }))}
              onNewOnchainActivity={onNewOnchainActivity}
            />
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>kWh</th>
                    <th>GPU%</th>
                    <th>REN%</th>
                    <th>LOAD</th>
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
                      <td>{fmtCurrency(n.energyPrice)}</td>
                      <td>
                        <div className="barCell">
                          <div className="bar barInline">
                            <i style={{ width: `${clamp(n.gpuSupply, 0, 100)}%` }} />
                          </div>
                          <strong>{Math.round(n.gpuSupply)}</strong>
                        </div>
                      </td>
                      <td>{fmtPct(n.renewablePct)}</td>
                      <td>
                        <div className="barCell">
                          <div className="bar barInline">
                            <i
                              className="barWorkload"
                              style={{ width: `${clamp(n.workloadsActive, 0, 100)}%` }}
                            />
                          </div>
                          <strong>{Math.round(n.workloadsActive)}</strong>
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
                <div className="label">Renewables</div>
                <div className="value">{Math.round(stats.avgRenew)}%</div>
              </div>
              <div className="metricCard">
                <div className="label">Efficiency</div>
                <div className="value">{Math.round(stats.avgEfficiency)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel panelCenter" aria-label="Global infrastructure">
          <div className="panelHeader">
            <h2>Map</h2>
            <div className="pill pillCompact">
              <span className={`dot ${crisis.active ? "bad blink" : "good"}`} />
              <span>{crisis.active ? "Crisis mode" : "Steady state"}</span>
            </div>
          </div>
          <div className="panelBody panelBodyMap">
            <WorldMap
              nodes={nodes}
              crisis={crisis.active}
              migrationArcs={migrationArcs}
              overloadedNodeId={overloadedNodeId}
            />
            <AllocationMeters
              humanPct={humanAllocation}
              agentPct={agentAllocation}
              crisis={crisis.active}
            />
            <div className="nodeCardsCompact">
              {nodes.map((n) => (
                <div key={n.id} className={`nodeMini ${overloadedNodeId === n.id && crisis.active ? "nodeMini--hot" : ""}`}>
                  <strong>{n.name.split(" ")[0]}</strong>
                  <span>Carbon {n.carbonScore}</span>
                  <span>{fmtCurrency(n.energyPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel" aria-label="Trade tape">
          <div className="panelHeader">
            <h2>Trade Tape</h2>
            <div className="pill pillCompact">
              <span className="dot dotAccent" />
              <span>{sortedActivity.length} prints</span>
            </div>
          </div>
          <div className="panelBody panelBodyFeed">
            <div className="feed">
              {crisis.active ? (
                <div className="humanOut blink">
                  Market alert: discretionary load curtailed as bids accelerate.
                </div>
              ) : null}
              {sortedActivity.slice(0, 10).map((e) => (
                <div className={`feedItem feedItem--${e.kind}`} key={e.id}>
                  <div className="feedMeta">
                    <span className="feedKind">{e.kind.toUpperCase()}</span>
                    <span className="time">{timeAgo(e.at, nowMs)}</span>
                  </div>
                  <div className="msg">{e.message}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="bottomBar">
        <div className={`bottomGrid ${crisis.active ? "bottomGrid--locked" : ""}`}>
          <div className="controlsLeft crisisControls">
            <div className="humanFacing">
              <div className="controlLabel">Crisis duration</div>
              <select
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                disabled={crisis.active}
              >
                <option value={10}>10s</option>
                <option value={20}>20s</option>
                <option value={35}>35s</option>
                <option value={50}>50s</option>
              </select>
            </div>
            <button
              type="button"
              className={`btn btnPrimary ${crisis.active ? "blink" : ""}`}
              onClick={triggerCrisis}
              disabled={crisis.active}
            >
              SIM: GRID SHOCK
            </button>
            <button type="button" className="btn" onClick={clearCrisis} disabled={!crisis.active}>
              Clear Crisis
            </button>
            <button type="button" className="btn" onClick={resetDemo}>
              Reset demo
            </button>
          </div>
          <div className="priceImpact humanFacing">
            <div className="title">Risk / Sustainability</div>
            <div className="sub">
              Carbon avg: <strong>{Math.round(stats.avgCarbon)}</strong> • Renewables:{" "}
              <strong>{Math.round(stats.avgRenew)}%</strong> • Efficiency:{" "}
              <strong>{Math.round(stats.avgEfficiency)}</strong>
            </div>
          </div>
        </div>
      </div>

      {crisis.active ? <div className="crisisOverlay" aria-hidden="true" /> : null}
    </div>
  );
}
