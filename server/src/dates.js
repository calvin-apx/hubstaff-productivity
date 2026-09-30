// Date helpers. Everything is the machine's local time; Hubstaff groups days by the organization timezone.

export function todayLocal(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

// "2026-09-29" + (-6) -> "2026-09-23"
export function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayLocal(d);
}

// Start (inclusive) and stop (exclusive) of a local calendar day, as ISO instants for the API.
export function localDayBounds(date) {
  const start = new Date(`${date}T00:00:00`);
  const stop = new Date(start);
  stop.setDate(stop.getDate() + 1);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

// "17:30" -> 1050 (minutes since midnight)
export function parseHHMM(text) {
  const [h, m] = String(text).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesSinceMidnight(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}
