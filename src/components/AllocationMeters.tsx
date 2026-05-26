type Props = {
  humanPct: number;
  agentPct: number;
  crisis: boolean;
};

export default function AllocationMeters({ humanPct, agentPct, crisis }: Props) {
  return (
    <div className={`allocationMeters ${crisis ? "allocationMeters--crisis" : ""}`}>
      <div className="allocationHeader">
        <span>Infrastructure allocation</span>
        {crisis ? <span className="allocationWarn blink">Agents dominating bids</span> : null}
      </div>

      <div className="allocationRow">
        <div className="allocationLabel">
          <span>Human allocation</span>
          <strong>{Math.round(humanPct)}%</strong>
        </div>
        <div className="bar allocationBar">
          <i
            className="allocationHuman"
            style={{ width: `${humanPct}%` }}
          />
        </div>
      </div>

      <div className="allocationRow">
        <div className="allocationLabel">
          <span>Agent allocation</span>
          <strong>{Math.round(agentPct)}%</strong>
        </div>
        <div className="bar allocationBar">
          <i
            className="allocationAgent"
            style={{ width: `${agentPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
