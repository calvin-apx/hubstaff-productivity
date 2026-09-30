// What Hubstaff saw you work on: hours per task, then the day's sessions in order.
// Collapsed by default; "Plan" copies a task name into the catch-up form.
export default function WorkedToday({ summary, timeline, onPlan }) {
  if (!summary) return null;

  return (
    <details className="card">
      <summary>
        What you worked on <span className="muted">({summary.trackedHours} h)</span>
      </summary>

      {summary.byTask.length === 0 ? (
        <p className="muted">Nothing tracked for this day yet.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Hours</th>
              <th>Activity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {summary.byTask.map((t) => (
              <tr key={`${t.projectId}:${t.taskId}`}>
                <td>{t.taskName}</td>
                <td className="muted">{t.projectName}</td>
                <td>{t.trackedHours} h</td>
                <td>{t.activityPercent}%</td>
                <td className="right">
                  <button className="link" onClick={() => onPlan(t.taskId ? t.taskName : t.projectName)}>
                    Plan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {timeline.length > 0 && (
        <>
          <h3>Timeline</h3>
          <ul className="timeline">
            {timeline.map((s) => (
              <li key={s.start}>
                <span className="time">
                  {clock(s.start)} to {clock(s.end)}
                </span>
                <span className="what">
                  {s.taskName} <span className="muted">in {s.projectName}</span>
                </span>
                <span className="muted">
                  {s.trackedHours} h, {s.activityPercent}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
