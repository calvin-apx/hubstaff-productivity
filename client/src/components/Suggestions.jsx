import { useState } from "react";

const SHOW_FIRST = 8;

// Open work you could pick up next, from Hubstaff to-dos and (when configured) Jira.
// "Plan" copies an item into the catch-up form below.
export default function Suggestions({ data, error, gapHours, onPlan }) {
  const [showAll, setShowAll] = useState(false);
  const sources = data?.sources || {};
  const hubstaffNote = sources.hubstaff?.scope === "recent-projects" && sources.hubstaff.count > 0;
  const all = data?.suggestions || [];
  const shown = showAll ? all : all.slice(0, SHOW_FIRST);

  return (
    <section className="card">
      <h2>What to do next</h2>
      <p className="muted">
        {gapHours > 0
          ? `${gapHours} h to make up. Pick from your open work:`
          : "No gap for this day. Your open work, in case you want to get ahead:"}
      </p>

      {error && <p className="error">{error}</p>}
      {sources.hubstaff?.error && <p className="error">Hubstaff: {sources.hubstaff.error}</p>}
      {sources.jira?.error && <p className="error">Jira: {sources.jira.error}</p>}

      {!data ? (
        <p className="muted">Loading...</p>
      ) : all.length === 0 ? (
        <p className="muted">
          Nothing open was found.{" "}
          {sources.jira?.enabled
            ? "Assign yourself Jira issues or Hubstaff to-dos, or add a task by hand below."
            : "Assign yourself Hubstaff to-dos, or set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN in .env to pull your Jira issues."}
        </p>
      ) : (
        <>
          {hubstaffNote && (
            <p className="muted small">No Hubstaff to-dos are assigned to you, so these are open to-dos from projects you worked on this week.</p>
          )}
          <ul className="suggestions">
            {shown.map((s) => (
              <li key={`${s.source}:${s.taskId}`}>
                <div className="what">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.taskName}
                    </a>
                  ) : (
                    s.taskName
                  )}{" "}
                  <span className="muted">in {s.projectName}</span>
                </div>
                <div className="tags">
                  <span className="tag">{s.source}</span>
                  {s.status && <span className={`tag ${s.active ? "tag-ok" : ""}`}>{s.status}</span>}
                  {s.priority && s.priority !== "Medium" && <span className="tag">{s.priority}</span>}
                  {s.workedToday && <span className="tag">worked today, {s.todayHours} h</span>}
                  {!s.workedToday && s.weekHours > 0 && <span className="tag">{s.weekHours} h this week</span>}
                  {s.dueAt && <span className={`tag ${isOverdue(s.dueAt) ? "tag-bad" : ""}`}>due {day(s.dueAt)}</span>}
                </div>
                <button className="link" onClick={() => onPlan(s.taskName)}>
                  Plan
                </button>
              </li>
            ))}
          </ul>
          {all.length > SHOW_FIRST && (
            <button className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${all.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

const isOverdue = (iso) => new Date(iso) < new Date();
const day = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
