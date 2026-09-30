// HTTP API. Every route is small on purpose: fetch, evaluate, read or write tasks, respond.
import { Router } from "express";
import { config } from "./config.js";
import { TokenManager } from "./hubstaff/auth.js";
import {
  HubstaffClient,
  getMe,
  getOrganizations,
  getProjects,
  getDailyActivities,
  getActivities,
  getOpenTasks,
} from "./hubstaff/client.js";
import { summarizeDay, buildTimeline, suggestTasks, rankIssues, evaluateDay, mergeNames, emptyNames } from "./productivity.js";
import { jiraEnabled, searchIssues } from "./jira/client.js";
import * as store from "./store.js";
import { toastForEvaluation } from "./notify.js";
import { todayLocal, isIsoDate, localDayBounds, shiftDate } from "./dates.js";

const tokens = new TokenManager({ pat: config.hubstaff.pat, tokenUrl: config.hubstaff.tokenUrl, dataDir: config.dataDir });
const hubstaff = new HubstaffClient({ apiBase: config.hubstaff.apiBase, tokens });

// Org id, user id and project names rarely change, so they are looked up once per process.
let identity = null;
async function getIdentity() {
  if (identity) return identity;

  const userId = config.hubstaff.userId || (await getMe(hubstaff)).id;

  let organizationId = config.hubstaff.organizationId;
  if (!organizationId) {
    const orgs = await getOrganizations(hubstaff);
    if (orgs.length === 0) throw new Error("Your Hubstaff user belongs to no organization.");
    organizationId = orgs[0].id;
    if (orgs.length > 1) {
      console.log(`Using organization "${orgs[0].name}" (${orgs[0].id}). Set HUBSTAFF_ORGANIZATION_ID to pick another.`);
    }
  }

  // Project names as a fallback in case a response does not side-load them.
  const projects = await getProjects(hubstaff, organizationId);
  const names = emptyNames();
  projects.forEach((p) => names.projects.set(p.id, p.name));

  identity = { userId, organizationId, names };
  return identity;
}

// Fetches one day from Hubstaff (daily totals + ten-minute slots) and applies the rule.
// Used by the API and by the scheduler.
export async function evaluateDate(date) {
  const { userId, organizationId, names: knownNames } = await getIdentity();
  const [daily, slots] = await Promise.all([
    getDailyActivities(hubstaff, organizationId, { start: date, stop: date, userId }),
    getActivities(hubstaff, organizationId, { ...localDayBounds(date), userId }),
  ]);
  const names = mergeNames(knownNames, daily.names, slots.names);
  const mine = (rows) => rows.filter((row) => row.user_id === userId);

  const summary = summarizeDay(mine(daily.items), names);
  const timeline = buildTimeline(mine(slots.items), names);
  const evaluation = evaluateDay(summary, config.rule);
  return { date, summary, timeline, evaluation, fetchedAt: new Date().toISOString() };
}

// Open Hubstaff to-dos assigned to you, ranked. When nothing is assigned to you, falls back
// to all open to-dos in the projects you tracked time on during the last 7 days.
async function hubstaffSuggestions(date) {
  const { userId, organizationId, names: knownNames } = await getIdentity();
  const [week, assigned] = await Promise.all([
    getDailyActivities(hubstaff, organizationId, { start: shiftDate(date, -6), stop: date, userId }),
    getOpenTasks(hubstaff, organizationId, { userId }),
  ]);
  const weekRows = week.items.filter((row) => row.user_id === userId);

  let tasks = assigned;
  let scope = "assigned";
  if (assigned.items.length === 0) {
    const projectIds = [...new Set(weekRows.map((row) => row.project_id).filter(Boolean))];
    tasks = projectIds.length ? await getOpenTasks(hubstaff, organizationId, { projectIds }) : { items: [], names: emptyNames() };
    scope = "recent-projects";
  }

  const names = mergeNames(knownNames, week.names, tasks.names);
  return { scope, list: suggestTasks({ openTasks: tasks.items, weekRows, date, names }) };
}

// Runs a source and turns its failure into { error } so the other source still shows.
const tolerant = (fn) => fn().catch((err) => ({ list: [], error: err.message }));

// Everything you could pick up next: Hubstaff to-dos first, then Jira issues (when configured).
export async function suggestForDate(date) {
  const [hub, jira] = await Promise.all([
    tolerant(() => hubstaffSuggestions(date)),
    jiraEnabled()
      ? tolerant(async () => ({ list: rankIssues(await searchIssues(), config.jira.statusOrder) }))
      : { list: [] },
  ]);
  return {
    date,
    sources: {
      hubstaff: { scope: hub.scope || null, count: hub.list.length, error: hub.error || null },
      jira: { enabled: jiraEnabled(), count: jira.list.length, error: jira.error || null },
    },
    suggestions: [...hub.list, ...jira.list],
  };
}

export const router = Router();

// Async handlers: anything thrown becomes a JSON { error } response.
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err.message);
    res.status(err.status || 500).json({ error: err.message });
  });

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function dateFrom(req) {
  const date = req.query.date || req.body?.date || todayLocal();
  if (!isIsoDate(date)) throw badRequest("date must be YYYY-MM-DD");
  return date;
}

router.get("/config", (req, res) => {
  res.json({ rule: config.rule, notify: config.notify, hasToken: Boolean(config.hubstaff.pat) });
});

router.get("/status", wrap(async (req, res) => {
  res.json(await evaluateDate(dateFrom(req)));
}));

router.get("/suggestions", wrap(async (req, res) => {
  res.json(await suggestForDate(dateFrom(req)));
}));

// Same as /status but also sends the desktop toast right now.
router.post("/check", wrap(async (req, res) => {
  const result = await evaluateDate(dateFrom(req));
  toastForEvaluation(result.evaluation);
  res.json(result);
}));

router.get("/tasks", wrap(async (req, res) => {
  res.json({ tasks: store.listTasks(dateFrom(req)) });
}));

router.post("/tasks", wrap(async (req, res) => {
  const { title, estimateHours } = req.body || {};
  if (!title?.trim() || !(Number(estimateHours) > 0)) throw badRequest("title and a positive estimateHours are required");
  const task = store.addTask({ date: dateFrom(req), title: title.trim(), estimateHours: Number(estimateHours) });
  res.status(201).json({ task });
}));

router.patch("/tasks/:id", wrap(async (req, res) => {
  const allowed = ["title", "estimateHours", "done"];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if ("estimateHours" in patch) patch.estimateHours = Number(patch.estimateHours);
  const task = store.updateTask(req.params.id, patch);
  if (!task) return res.status(404).json({ error: "task not found" });
  res.json({ task });
}));

router.delete("/tasks/:id", wrap(async (req, res) => {
  if (!store.deleteTask(req.params.id)) return res.status(404).json({ error: "task not found" });
  res.status(204).end();
}));
