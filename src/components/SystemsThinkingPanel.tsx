import { useEffect, useState } from "react";
import { SYSTEMS_INSIGHTS } from "../lib/data";

export default function SystemsThinkingPanel() {
  const [index, setIndex] = useState(0);
  const insight = SYSTEMS_INSIGHTS[index];

  useEffect(() => {
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % SYSTEMS_INSIGHTS.length);
    }, 8000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="systemsPanel">
      <div className="systemsPanelHeader">
        <h3>Systems Thinking</h3>
        <div className="systemsDots" aria-hidden="true">
          {SYSTEMS_INSIGHTS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`systemsDot ${i === index ? "systemsDot--active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Show ${s.label}`}
            />
          ))}
        </div>
      </div>
      <div className="systemsLabel">{insight.label}</div>
      <div className="systemsTitle">{insight.title}</div>
      <p className="systemsBody">{insight.body}</p>
    </div>
  );
}
