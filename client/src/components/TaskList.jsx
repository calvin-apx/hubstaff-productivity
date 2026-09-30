export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) return <p className="muted">No tasks for this day yet.</p>;

  return (
    <ul className="tasks">
      {tasks.map((t) => (
        <li key={t.id} className={t.done ? "done" : ""}>
          <label>
            <input type="checkbox" checked={t.done} onChange={() => onToggle(t)} />
            <span>{t.title}</span>
          </label>
          <span className="hours">{t.estimateHours} h</span>
          <button className="link" onClick={() => onDelete(t.id)} aria-label="Delete task">
            &times;
          </button>
        </li>
      ))}
    </ul>
  );
}
