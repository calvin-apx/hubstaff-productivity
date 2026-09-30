// Verdict for the selected day: tracked vs target, activity, the gap, and how much of it is planned.
export default function StatusCard({ status, loading, plannedHours, doneHours, onRefresh, onCheck }) {
  if (!status) {
    return <section className="card">{loading ? "Loading Hubstaff data..." : "No data for this day."}</section>;
  }

  const { evaluation: e, summary, fetchedAt } = status;
  const remaining = Math.max(0, round(e.gapHours - plannedHours));

  return (
    <section className={`card status ${e.productive ? "ok" : "bad"}`}>
      <div className="status-head">
        <span className="badge">{e.productive ? "Productive" : "Not productive"}</span>
        <div className="actions">
          <button onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
          <button onClick={onCheck} disabled={loading}>
            Check and notify
          </button>
        </div>
      </div>

      <dl className="stats">
        <Stat label="Tracked" value={`${e.trackedHours} h`} note={`/ ${e.targetHours} h`} />
        <Stat label="Activity" value={`${e.activityPercent}%`} note={`/ min ${e.minActivityPercent}%`} />
        <Stat label="Gap" value={`${e.gapHours} h`} />
        <Stat label="Planned" value={`${round(plannedHours)} h`} note={`${round(doneHours)} h done`} />
        <Stat label="Still to plan" value={`${remaining} h`} />
      </dl>

      {e.reasons.length > 0 && (
        <ul className="reasons">
          {e.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {summary.byProject.length > 0 && (
        <p className="muted small">
          By project: {summary.byProject.map((p) => `${p.projectName} ${p.trackedHours} h`).join(", ")}
        </p>
      )}

      <p className="muted small">
        Fetched {new Date(fetchedAt).toLocaleTimeString()}. Hubstaff uploads activity with a delay of about ten minutes.
      </p>
    </section>
  );
}

function Stat({ label, value, note }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value} {note && <span className="muted">{note}</span>}
      </dd>
    </div>
  );
}

const round = (n) => Math.round(n * 100) / 100;
