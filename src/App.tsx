import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import AllocationMeters from "./components/AllocationMeters";
import OnchainMarketplace from "./components/OnchainMarketplace";
import OrderTicket from "./components/OrderTicket";
import WorldMap from "./components/WorldMap";
import { DEFAULT_AGENT_ORIGIN_NODE } from "./lib/collection";
import { useMarketplaceOrder } from "./hooks/useMarketplaceOrder";
import { useResourceCollection } from "./hooks/useResourceCollection";
import {
  cloneDefaultNodes,
  CRISIS_AGENT_ALLOCATION,
  CRISIS_HUMAN_ALLOCATION,
  seedActivity,
  STEADY_AGENT_ALLOCATION,
  STEADY_HUMAN_ALLOCATION,
} from "./lib/data";
import {
  resourceLabel,
  resourceShort,
  totalCostUsd,
  unitPriceForResource,
  type BuyDraft,
  type ResourceKind,
} from "./lib/marketplace";
import { genCrisisBurst, genMarketUpdate } from "./lib/simulation";
import type {
  Activity,
  CollectedAsset,
  CrisisState,
  MarketNode,
  MigrationArc,
  ScoutConfig,
  ScoutStatus,
} from "./lib/types";
import { ACTIVITY_PRIORITY, clamp, fmtCurrency, fmtSignedPct, timeAgo, uid } from "./lib/utils";
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
  const [scoutSensitivity, setScoutSensitivity] = useState<"low" | "medium" | "high">("medium");
  const [scoutCooldownMode, setScoutCooldownMode] = useState<"short" | "normal">("normal");
  const [scoutFilters, setScoutFilters] = useState<Record<Exclude<ScoutStatus, "normal">, boolean>>({
    cheap: true,
    expensive: true,
    extreme: true,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [humanAllocation, setHumanAllocation] = useState(STEADY_HUMAN_ALLOCATION);
  const [agentAllocation, setAgentAllocation] = useState(STEADY_AGENT_ALLOCATION);
  const [migrationArcs, setMigrationArcs] = useState<MigrationArc[]>([]);
  const [buyDraft, setBuyDraft] = useState<BuyDraft | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collectedAssets, setCollectedAssets] = useState<CollectedAsset[]>([]);

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
    setBuyDraft(null);
    setSelectedNodeId(null);
    setCollectedAssets([]);
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

  const scoutConfig = useMemo<ScoutConfig>(() => {
    const bySensitivity = {
      low: { cheapThresholdPct: 16, expensiveThresholdPct: 16, extremeThresholdPct: 28, ewmaAlpha: 0.08 },
      medium: { cheapThresholdPct: 12, expensiveThresholdPct: 12, extremeThresholdPct: 22, ewmaAlpha: 0.12 },
      high: { cheapThresholdPct: 9, expensiveThresholdPct: 9, extremeThresholdPct: 18, ewmaAlpha: 0.16 },
    } as const;
    const cooldownMs = scoutCooldownMode === "short" ? 12_000 : 24_000;
    return {
      ...bySensitivity[scoutSensitivity],
      alertCooldownMs: cooldownMs,
    };
  }, [scoutSensitivity, scoutCooldownMode]);

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

  const scoutWatchlist = useMemo(() => {
    return [...nodes]
      .filter((n) => (n.scoutStatus ?? "normal") !== "normal")
      .filter((n) => {
        const status = n.scoutStatus ?? "normal";
        if (status === "normal") return false;
        return scoutFilters[status];
      })
      .sort((a, b) => Math.abs(b.priceDeviationPct ?? 0) - Math.abs(a.priceDeviationPct ?? 0))
      .slice(0, 8);
  }, [nodes, scoutFilters]);

  const scoutAlertCount = useMemo(
    () => nodes.filter((n) => (n.scoutStatus ?? "normal") !== "normal").length,
    [nodes],
  );

  const onNewOnchainActivity = useCallback((a: Activity) => {
    setOnchainActivity((prev) => [a, ...prev].slice(0, 18));
  }, []);

  const { canUseOnchain, isPending: onchainPending, createBuyOrder } = useMarketplaceOrder(onNewOnchainActivity);

  useResourceCollection({
    agentOriginNodeId: DEFAULT_AGENT_ORIGIN_NODE,
    onCollectedAsset: (asset) => setCollectedAssets((prev) => [asset, ...prev].slice(0, 12)),
    onCollectionArc: (arc) => setMigrationArcs((prev) => [arc, ...prev].slice(0, 8)),
    onTapeEvent: (a) => setOnchainActivity((prev) => [a, ...prev].slice(0, 18)),
  });

  const buyNode = useMemo(
    () => (buyDraft ? nodes.find((n) => n.id === buyDraft.nodeId) ?? null : null),
    [buyDraft, nodes],
  );

  const selectVenue = useCallback((node: MarketNode | null) => {
    setSelectedNodeId(node?.id ?? null);
    if (node) {
      setBuyDraft((prev) => ({
        nodeId: node.id,
        resource: prev?.nodeId === node.id ? prev.resource : "energy",
        quantity: prev?.nodeId === node.id ? prev.quantity : 10,
      }));
    }
  }, []);

  const openBuyIntent = useCallback((node: MarketNode, resource: ResourceKind, quantity = 10) => {
    setSelectedNodeId(node.id);
    setBuyDraft({ nodeId: node.id, resource, quantity });
  }, []);

  const executeSimulatedBuy = useCallback(
    (draft: BuyDraft) => {
      const node = nodes.find((n) => n.id === draft.nodeId);
      if (!node) return;

      const unitPrice = unitPriceForResource(node, draft.resource);
      const total = totalCostUsd(unitPrice, draft.quantity);
      const venue = node.name.replace(" Node", "");

      setActivity((prev) =>
        [
          {
            id: uid("buy"),
            at: Date.now(),
            kind: "purchase" as const,
            message: `Fill: You bought ${draft.quantity} ${resourceLabel(draft.resource)} @ ${venue} for $${total.toFixed(2)} (${resourceShort(draft.resource)} @ $${unitPrice.toFixed(3)}).`,
            toNodeId: node.id,
          },
          ...prev,
        ].slice(0, 24),
      );

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          if (draft.resource === "energy") {
            return {
              ...n,
              workloadsActive: clamp(n.workloadsActive + draft.quantity * 0.4, 0, 100),
              gpuSupply: clamp(n.gpuSupply - draft.quantity * 0.15, 8, 100),
            };
          }
          return {
            ...n,
            gpuSupply: clamp(n.gpuSupply - draft.quantity * 0.8, 8, 100),
            workloadsActive: clamp(n.workloadsActive + draft.quantity * 0.6, 0, 100),
          };
        }),
      );

      setBuyDraft({ nodeId: node.id, resource: draft.resource, quantity: draft.quantity });
    },
    [nodes],
  );

  const submitOnchainBuy = useCallback(
    async (draft: BuyDraft, unitPriceUsd: string) => {
      await createBuyOrder({
        nodeId: draft.nodeId,
        resource: draft.resource,
        unitPriceUsd,
        quantity: draft.quantity,
      });
    },
    [createBuyOrder],
  );

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
      setNodes((prev) => {
        const crisisNow = crisisRef.current;
        const { next, events } = genMarketUpdate(prev, crisisNow, scoutConfig);

        if (events.length > 0) {
          setActivity((a) => [...events, ...a].slice(0, 24));
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
  }, [pushMigrationArc, scoutConfig]);

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
      setMigrationArcs((arcs) => arcs.filter((a) => Date.now() - a.startedAt < (a.durationMs ?? 5000)));
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
          <div className="brandTitle">SONERGY</div>
          <div className="brandSub">RESOURCE DESK</div>
        </div>
        <div className="deskTicker">
          <span>
            AVG ENR <strong>{fmtCurrency(stats.avgEnergy)}</strong>
          </span>
          <span>
            REN <strong>{Math.round(stats.avgRenew)}%</strong>
          </span>
          <span>
            CARB <strong>{Math.round(stats.avgCarbon)}</strong>
          </span>
          <span>
            EFF <strong>{Math.round(stats.avgEfficiency)}</strong>
          </span>
          <span className={scoutAlertCount > 0 ? "deskTickerAlert" : ""}>
            SCOUT <strong>{scoutAlertCount}</strong>
          </span>
        </div>
        <div className="topbarSpacer" />
        <div className="walletSlot">
          <ConnectButton />
        </div>
        <button type="button" className="btn btnGhost btnXs" onClick={resetDemo}>
          RST
        </button>
        <div className="pill pillDesk" aria-label="System health">
          <span className={`dot ${systemHealth.dot} ${crisis.active ? "blink" : ""}`} />
          <span>
            SYS <strong>{systemHealth.label.toUpperCase()}</strong>
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
        <section className="panel humanFacing panelDesk" aria-label="Trading desk">
          <div className="panelHeader">
            <h2>Desk</h2>
            <div className="pill pillCompact pillDesk">
              <span className="dot dotAccent" />
              <span>SIM · CHAIN</span>
            </div>
          </div>
          <div className="panelBody panelBodyDesk">
            <OrderTicket
              node={buyNode}
              draft={buyDraft}
              canSubmitOnchain={canUseOnchain}
              onchainPending={onchainPending}
              onDraftChange={setBuyDraft}
              onClear={() => {
                setBuyDraft(null);
                setSelectedNodeId(null);
              }}
              onExecuteSimulated={executeSimulatedBuy}
              onSubmitOnchain={submitOnchainBuy}
            />
            <OnchainMarketplace
              nodes={nodes.map((n) => ({
                id: n.id,
                name: n.name,
                energyPrice: n.energyPrice,
                gpuSupply: n.gpuSupply,
              }))}
              buyIntent={buyDraft}
              onBuyIntent={setBuyDraft}
              chainId={chainId}
              canUseOnchain={canUseOnchain}
              isPending={onchainPending}
              createBuyOrder={createBuyOrder}
              collectedAssets={collectedAssets}
            />
            <div className="scoutWatchlist">
              <div className="scoutWatchlistHeader">
                <strong>SCOUT WATCH</strong>
                <div className="scoutFilterRow">
                  <label>
                    <input
                      type="checkbox"
                      checked={scoutFilters.cheap}
                      onChange={(e) => setScoutFilters((f) => ({ ...f, cheap: e.target.checked }))}
                    />
                    CHEAP
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={scoutFilters.expensive}
                      onChange={(e) => setScoutFilters((f) => ({ ...f, expensive: e.target.checked }))}
                    />
                    EXPENSIVE
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={scoutFilters.extreme}
                      onChange={(e) => setScoutFilters((f) => ({ ...f, extreme: e.target.checked }))}
                    />
                    EXTREME
                  </label>
                </div>
              </div>
              {scoutWatchlist.length === 0 ? (
                <div className="onchainHint">No significant deviations right now.</div>
              ) : (
                <table className="scoutTable">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Now</th>
                      <th>Base</th>
                      <th>Dev</th>
                      <th>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoutWatchlist.map((n) => (
                      <tr key={n.id} className={`scoutRow scoutRow--${n.scoutStatus ?? "normal"}`}>
                        <td>{n.name.split(" ").slice(0, 2).join(" ")}</td>
                        <td>{fmtCurrency(n.energyPrice).replace("/kWh", "")}</td>
                        <td>${(n.priceBaseline ?? n.energyPrice).toFixed(2)}</td>
                        <td>{fmtSignedPct(n.priceDeviationPct ?? 0, 1)}</td>
                        <td>{(n.scoutStatus ?? "normal").toUpperCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="tableWrap blotterWrap">
              <table className="blotter">
                <thead>
                  <tr>
                    <th>VENUE</th>
                    <th>ENR</th>
                    <th>GPU</th>
                    <th>DEV</th>
                    <th>TRD</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => (
                    <tr
                      key={n.id}
                      className={`marketRow marketRow--${n.scoutStatus ?? "normal"} ${selectedNodeId === n.id ? "marketRow--selected" : ""}`}
                      onClick={() => selectVenue(n)}
                    >
                      <td>
                        <div className="nodeName">
                          <span>{n.name.replace(" Node", "")}</span>
                          <span>{n.regionTag}</span>
                        </div>
                      </td>
                      <td className="num">{fmtCurrency(n.energyPrice)}</td>
                      <td className="num">{Math.round(n.gpuSupply)}%</td>
                      <td className={`num ${(n.priceDeviationPct ?? 0) < 0 ? "numDown" : (n.priceDeviationPct ?? 0) > 0 ? "numUp" : ""}`}>
                        {fmtSignedPct(n.priceDeviationPct ?? 0, 1)}
                      </td>
                      <td className="blotterTrade">
                        <button
                          type="button"
                          className="blotterBtn blotterBtn--enr"
                          onClick={(e) => {
                            e.stopPropagation();
                            openBuyIntent(n, "energy");
                          }}
                        >
                          ENR
                        </button>
                        <button
                          type="button"
                          className="blotterBtn blotterBtn--gpu"
                          onClick={(e) => {
                            e.stopPropagation();
                            openBuyIntent(n, "compute");
                          }}
                        >
                          GPU
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel panelCenter panelDesk" aria-label="Venue map">
          <div className="panelHeader">
            <h2>Venue Map</h2>
            <div className="pill pillCompact pillDesk">
              <span className={`dot ${crisis.active ? "bad blink" : "good"}`} />
              <span>{crisis.active ? "SHOCK" : "STABLE"}</span>
            </div>
          </div>
          <div className="panelBody panelBodyMap">
            <WorldMap
              nodes={nodes}
              crisis={crisis.active}
              migrationArcs={migrationArcs}
              overloadedNodeId={overloadedNodeId}
              selectedNodeId={selectedNodeId}
              onSelectNode={selectVenue}
              onBuyIntent={openBuyIntent}
            />
            <AllocationMeters
              humanPct={humanAllocation}
              agentPct={agentAllocation}
              crisis={crisis.active}
            />
          </div>
        </section>

        <section className="panel panelDesk" aria-label="Trade tape">
          <div className="panelHeader">
            <h2>Tape</h2>
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
            <div className="humanFacing">
              <div className="controlLabel">Scout sensitivity</div>
              <select value={scoutSensitivity} onChange={(e) => setScoutSensitivity(e.target.value as "low" | "medium" | "high")}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="humanFacing">
              <div className="controlLabel">Scout cooldown</div>
              <select value={scoutCooldownMode} onChange={(e) => setScoutCooldownMode(e.target.value as "short" | "normal")}>
                <option value="short">Short</option>
                <option value="normal">Normal</option>
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
