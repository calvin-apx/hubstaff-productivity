// Desktop toast notifications and the periodic "was I productive today?" check.
import notifier from "node-notifier";
import { config } from "./config.js";
import { todayLocal, minutesSinceMidnight, parseHHMM } from "./dates.js";

export function sendToast(title, message) {
  try {
    notifier.notify({ title, message, appID: "Hubstaff Productivity" });
  } catch (err) {
    console.warn("Toast failed:", err.message);
  }
}

export function toastForEvaluation(e) {
  const facts = `${e.trackedHours} h of ${e.targetHours} h tracked, ${e.activityPercent}% active.`;
  if (e.productive) sendToast("Productive day", facts);
  else sendToast("Not productive yet", `${facts} ${e.gapHours} h to make up.`);
}

let lastNotifiedDate = null;

// Runs every CHECK_INTERVAL_MINUTES while the server is up. After NOTIFY_AFTER it sends
// one toast for the day: always when not productive, and when productive only if
// NOTIFY_WHEN_PRODUCTIVE is true.
export function startScheduler(evaluateDate) {
  const run = async () => {
    const now = new Date();
    if (minutesSinceMidnight(now) < parseHHMM(config.notify.after)) return;
    const date = todayLocal(now);
    if (lastNotifiedDate === date) return;
    try {
      const { evaluation } = await evaluateDate(date);
      if (!evaluation.productive || config.notify.whenProductive) toastForEvaluation(evaluation);
      lastNotifiedDate = date;
    } catch (err) {
      console.warn("Scheduled check failed:", err.message);
    }
  };
  run();
  setInterval(run, config.notify.checkIntervalMinutes * 60 * 1000);
}
