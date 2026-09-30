import { shiftDate, todayLocal } from "../dates.js";

export default function DateNav({ date, onChange }) {
  return (
    <nav className="date-nav">
      <button onClick={() => onChange(shiftDate(date, -1))} aria-label="Previous day">
        &lsaquo;
      </button>
      <input type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} />
      <button onClick={() => onChange(shiftDate(date, 1))} aria-label="Next day">
        &rsaquo;
      </button>
      <button onClick={() => onChange(todayLocal())}>Today</button>
    </nav>
  );
}
