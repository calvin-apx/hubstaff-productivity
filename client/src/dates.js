// Local-time date helpers for the UI. Dates are plain YYYY-MM-DD strings.

export function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal() {
  return toIsoDate(new Date());
}

export function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}
