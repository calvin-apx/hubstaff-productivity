// The productivity rule and the day summaries it works on.
// Change evaluateDay() to change what "productive" means.

const SLOT_SECONDS = 600; // Hubstaff activity slots are ten minutes

const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const toHours = (seconds) => round(seconds / 3600);
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// names = { projects: Map<id, name>, tasks: Map<id, name> }
export const emptyNames = () => ({ projects: new Map(), tasks: new Map() });

export function mergeNames(...sets) {
  const names = emptyNames();
  for (const set of sets) {
    set.projects.forEach((name, id) => names.projects.set(id, name));
    set.tasks.forEach((name, id) => names.tasks.set(id, name));
  }
  return names;
}

const projectName = (names, id) => (id == null ? "No project" : names.projects.get(id) || `Project ${id}`);
const taskName = (names, id) => (id == null ? "No task" : names.tasks.get(id) || `Task ${id}`);

// Totals accumulator shared by projects, tasks and timeline sessions.
function bucket(map, key, extra = {}) {
  if (!map.has(key)) map.set(key, { ...extra, tracked: 0, overall: 0, keyboard: 0, mouse: 0, inputTracked: 0 });
  return map.get(key);
}

function add(b, row) {
  b.tracked += row.tracked || 0;
  b.overall += row.overall || 0;
  b.keyboard += row.keyboard || 0;
  b.mouse += row.mouse || 0;
  b.inputTracked += row.input_tracked ?? row.tracked ?? 0;
}

// Collapses Hubstaff daily_activities rows (one per project + task) into one summary for the day.
// All row fields are seconds. Hubstaff's activity % is active seconds ("overall") over seconds
// where input was measured ("input_tracked"). Manual time has no input, so it counts toward
// hours but not activity.
export function summarizeDay(rows, names = emptyNames()) {
  const total = bucket(new Map(), "total");
  const projects = new Map();
  const tasks = new Map();

  for (const row of rows) {
    add(total, row);
    add(bucket(projects, row.project_id, { projectId: row.project_id }), row);
    add(bucket(tasks, `${row.project_id}:${row.task_id}`, { projectId: row.project_id, taskId: row.task_id }), row);
  }

  const byHours = (a, b) => b.trackedHours - a.trackedHours;
  const byProject = [...projects.values()]
    .map((b) => ({
      projectId: b.projectId,
      projectName: projectName(names, b.projectId),
      trackedHours: toHours(b.tracked),
      activityPercent: percent(b.overall, b.inputTracked),
    }))
    .sort(byHours);
  const byTask = [...tasks.values()]
    .map((b) => ({
      projectId: b.projectId,
      taskId: b.taskId,
      projectName: projectName(names, b.projectId),
      taskName: taskName(names, b.taskId),
      trackedHours: toHours(b.tracked),
      activityPercent: percent(b.overall, b.inputTracked),
    }))
    .sort(byHours);

  return {
    trackedHours: toHours(total.tracked),
    activityPercent: percent(total.overall, total.inputTracked),
    keyboardPercent: percent(total.keyboard, total.inputTracked),
    mousePercent: percent(total.mouse, total.inputTracked),
    byProject,
    byTask,
  };
}

// Groups consecutive ten-minute slots on the same project and task into sessions, so the UI
// can show "09:05 to 10:40, CRM-4030". A session ends when the next slot is not the one right
// after it, or the work item changes. End = last slot start + ten minutes, so it can run up to
// ten minutes past the real stop.
export function buildTimeline(slots, names = emptyNames()) {
  const sorted = [...slots].sort((a, b) => new Date(a.time_slot) - new Date(b.time_slot));
  const sessions = [];
  let current = null;

  for (const slot of sorted) {
    const slotStart = new Date(slot.time_slot);
    const sameWork = current && current.projectId === slot.project_id && current.taskId === slot.task_id;
    const contiguous = current && slotStart - current.lastSlotStart <= SLOT_SECONDS * 1000;
    if (!(sameWork && contiguous)) {
      current = bucket(new Map(), "session", {
        projectId: slot.project_id,
        taskId: slot.task_id,
        start: new Date(slot.starts_at || slot.time_slot),
      });
      sessions.push(current);
    }
    add(current, slot);
    current.lastSlotStart = slotStart;
  }

  return sessions.map((s) => ({
    start: s.start.toISOString(),
    end: new Date(s.lastSlotStart.getTime() + SLOT_SECONDS * 1000).toISOString(),
    projectName: projectName(names, s.projectId),
    taskName: taskName(names, s.taskId),
    trackedHours: toHours(s.tracked),
    activityPercent: percent(s.overall, s.inputTracked),
  }));
}

// Soonest due date first; no due date last. Works for "YYYY-MM-DD" and ISO datetimes.
const compareDue = (a, b) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0);
const byUpdated = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt));

// Ranks open Hubstaff tasks for the catch-up plan. Order: tasks touched on the selected day
// first (momentum), then due date, then hours this week, then most recently updated.
// weekRows are daily_activities rows for the 7 days ending on `date`.
export function suggestTasks({ openTasks, weekRows, date, names = emptyNames() }) {
  const effort = new Map(); // task_id -> { today, week, lastDate } in seconds
  for (const row of weekRows) {
    if (row.task_id == null) continue;
    const e = effort.get(row.task_id) || { today: 0, week: 0, lastDate: null };
    e.week += row.tracked || 0;
    if (row.date === date) e.today += row.tracked || 0;
    if (!e.lastDate || row.date > e.lastDate) e.lastDate = row.date;
    effort.set(row.task_id, e);
  }

  return openTasks
    .map((task) => {
      const e = effort.get(task.id) || { today: 0, week: 0, lastDate: null };
      return {
        source: "hubstaff",
        taskId: task.id,
        taskName: task.summary,
        projectId: task.project_id,
        projectName: projectName(names, task.project_id),
        url: null,
        status: null,
        priority: null,
        dueAt: task.due_at || null,
        updatedAt: task.updated_at || null,
        workedToday: e.today > 0,
        todayHours: toHours(e.today),
        weekHours: toHours(e.week),
        lastWorked: e.lastDate,
      };
    })
    .sort((a, b) => b.workedToday - a.workedToday || compareDue(a.dueAt, b.dueAt) || b.weekHours - a.weekHours || byUpdated(a, b));
}

// Ranks Jira issues into the same shape as suggestTasks(). Order: status (by statusOrder, the
// first entry being what you are actively doing), then due date, then priority, then most
// recently updated. statusOrder entries match the status name case-insensitively as substrings.
const PRIORITY_RANK = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
const priorityRank = (name) => PRIORITY_RANK[String(name).toLowerCase()] ?? 2;

export function rankIssues(issues, statusOrder = ["In Progress", "To Do"]) {
  const order = statusOrder.map((s) => s.toLowerCase());
  const statusRank = (status) => {
    const index = order.findIndex((s) => String(status).toLowerCase().includes(s));
    return index === -1 ? order.length : index;
  };

  return issues
    .map((issue) => ({
      source: "jira",
      taskId: issue.key,
      taskName: `${issue.key} ${issue.summary}`,
      projectId: null,
      projectName: issue.project,
      url: issue.url,
      status: issue.status,
      statusRank: statusRank(issue.status),
      active: statusRank(issue.status) === 0,
      priority: issue.priority,
      dueAt: issue.dueAt,
      updatedAt: issue.updatedAt,
      workedToday: false,
      todayHours: 0,
      weekHours: 0,
      lastWorked: null,
    }))
    .sort(
      (a, b) =>
        a.statusRank - b.statusRank ||
        compareDue(a.dueAt, b.dueAt) ||
        priorityRank(a.priority) - priorityRank(b.priority) ||
        byUpdated(a, b)
    );
}

// Productive = enough hours AND enough activity. Gap = hours still missing to reach the target.
// Ideas for a stricter rule: count low-activity hours as lost, skip weekends, or use a
// different target per weekday. Whatever you return here is what the UI and the toast show.
export function evaluateDay(summary, rule) {
  const reasons = [];
  if (summary.trackedHours < rule.targetHours) {
    reasons.push(`Tracked ${summary.trackedHours} h, target is ${rule.targetHours} h.`);
  }
  if (summary.trackedHours > 0 && summary.activityPercent < rule.minActivityPercent) {
    reasons.push(`Activity ${summary.activityPercent}%, minimum is ${rule.minActivityPercent}%.`);
  }
  return {
    productive: reasons.length === 0,
    reasons,
    trackedHours: summary.trackedHours,
    targetHours: rule.targetHours,
    activityPercent: summary.activityPercent,
    minActivityPercent: rule.minActivityPercent,
    gapHours: round(Math.max(0, rule.targetHours - summary.trackedHours)),
  };
}
