# Hubstaff Productivity

A small local app that reads your day from Hubstaff, decides whether it was productive,
sends a Windows toast with the verdict, suggests which open Hubstaff tasks to pick up to
compensate, shows what you actually worked on (hours per task and a session timeline), and
lets you plan catch-up tasks with hour estimates.

Node.js (Express) on the back, React (Vite) on the front, JSON files for storage. No database,
no TypeScript, no CSS framework: everything is plain and meant to be edited by hand.

## Quick start

```
npm install
copy .env.example .env      # then put your token in HUBSTAFF_PAT
npm run dev                 # API on :3939, UI on http://localhost:5173
```

For a single process without the Vite dev server:

```
npm run build               # builds client/dist
npm start                   # serves API + UI on http://localhost:3939
```

### Getting the token

Create a Personal Access Token at https://developer.hubstaff.com/personal_access_tokens
and paste it into `.env` as `HUBSTAFF_PAT`. Tokens expire after 90 days; when Hubstaff
starts answering 401 for the refresh, make a new one and replace the value.

### Why a separate token

Hubstaff treats the PAT as a refresh token and rotates it on every exchange. The app saves
the rotated token in `server/data/tokens.json`. If another program (for example the Claude
Hubstaff MCP server) used the same PAT, each would invalidate the other's chain. One token
per program.

## Configuration

All settings live in `.env` and are read once by `server/src/config.js`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `HUBSTAFF_PAT` | | Personal Access Token for this app |
| `HUBSTAFF_ORGANIZATION_ID` | auto | First organization you belong to when empty |
| `HUBSTAFF_USER_ID` | auto | Your own user id when empty |
| `JIRA_BASE_URL` | | Optional. `https://your-site.atlassian.net` |
| `JIRA_EMAIL` | | Optional. Atlassian account email |
| `JIRA_API_TOKEN` | | Optional. Atlassian API token |
| `JIRA_JQL` | your open issues | Optional. Query behind the suggestion list |
| `JIRA_STATUS_ORDER` | In Progress,To Do,... | Optional. Status names shown first, in order |
| `PORT` | 3939 | API port. Also change the proxy target in `client/vite.config.js` |
| `TARGET_HOURS` | 8 | Hours per day you expect to track |
| `MIN_ACTIVITY_PERCENT` | 50 | Minimum Hubstaff activity level |
| `NOTIFY_AFTER` | 17:00 | Local time after which the daily toast may fire |
| `CHECK_INTERVAL_MINUTES` | 30 | How often the server re-checks today |
| `NOTIFY_WHEN_PRODUCTIVE` | true | Also toast on productive days, not only on bad ones |

## How "productive" is decided

`server/src/productivity.js`, function `evaluateDay()`:

- productive when tracked hours >= `TARGET_HOURS` **and** activity >= `MIN_ACTIVITY_PERCENT`
- gap = `TARGET_HOURS` minus tracked hours, never below zero
- `reasons` lists what failed and is shown in the UI

`summarizeDay()` above it turns Hubstaff's per-project-and-task rows into the day's totals,
plus `byProject` and `byTask` breakdowns. Activity follows Hubstaff's own definition: active
seconds over seconds with input tracking, so manual time counts toward hours but not activity.
Edit either function to change the rule; nothing else needs to know.

## What to do next

`/api/suggestions` lists your open Hubstaff to-dos (status active, assigned to you) ranked by
`suggestTasks()` in `server/src/productivity.js`:

1. tasks you already tracked time on that day (momentum)
2. due date, soonest first, no due date last
3. hours tracked on the task in the last 7 days
4. most recently updated

If nothing is assigned to you, it falls back to all open tasks in the projects you tracked time
on during the last 7 days, and the UI says so. "Plan" copies a task name into the catch-up
form.

### Jira as a second source

If your work lives in Jira rather than Hubstaff to-dos, set `JIRA_BASE_URL`, `JIRA_EMAIL` and
`JIRA_API_TOKEN` in `.env` (token from https://id.atlassian.com/manage-profile/security/api-tokens).
`server/src/jira/client.js` then runs `JIRA_JQL` (default: your open issues) and
`rankIssues()` orders them by status (`JIRA_STATUS_ORDER`, default "In Progress, To Do,
Code Review, In Test, Blocked"; matched as substrings so Japanese-labelled statuses like
"進行中(In Progress)" work), then due date, then priority, then last updated. Jira items link
to the issue and show its status. The card shows the first 8 with a "Show all" toggle.
Change `JIRA_JQL` to narrow the list, for example to the current sprint:

```
JIRA_JQL=assignee = currentUser() AND sprint in openSprints() AND statusCategory != Done ORDER BY priority
```

Each source fails independently: a Jira error shows inside the card while Hubstaff still works.

## What you worked on

`/api/status` also fetches the day's ten-minute activity slots and `buildTimeline()` merges
consecutive slots on the same project and task into sessions with start and end times. The
UI lists hours per task and the sessions in order inside a collapsed "What you worked on"
card. A session's end is the last slot's start plus ten minutes, so it can be up to ten
minutes late.

## Notifications

`server/src/notify.js` sends toasts through `node-notifier`. While the server is running it
checks today every `CHECK_INTERVAL_MINUTES`, and after `NOTIFY_AFTER` it sends one toast for
the day. The "Check and notify" button in the UI sends one immediately for the selected date.

If you want the check without keeping the app open, run `npm start` from a Windows Task
Scheduler job at your preferred time; the first check runs on startup.

## Project map

```
.env                        your settings (git-ignored)
server/
  src/index.js              Express app, serves client/dist when built, starts the scheduler
  src/config.js             reads .env, all defaults in one place
  src/routes.js             API routes and the evaluateDate() pipeline
  src/productivity.js       the rule: summarizeDay(), buildTimeline(), suggestTasks(), rankIssues(), evaluateDay()
  src/notify.js             toasts and the periodic check
  src/store.js              tasks.json read/write
  src/dates.js              local date helpers
  src/hubstaff/auth.js      PAT -> access token, saves rotated refresh token
  src/hubstaff/client.js    GET with bearer auth, 401 retry, pagination, endpoint helpers
  src/jira/client.js        optional Jira Cloud search (basic auth with API token)
  data/                     tokens.json and tasks.json (git-ignored)
client/
  src/App.jsx               state, data loading, task actions
  src/api.js                fetch wrappers for /api
  src/components/           DateNav, StatusCard, Suggestions, TaskForm, TaskList, WorkedToday
  src/styles.css            theme variables + layout
  vite.config.js            dev server and /api proxy
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/config` | thresholds and whether a token is set |
| GET | `/api/status?date=YYYY-MM-DD` | summary (totals, byProject, byTask), timeline and evaluation for the day |
| GET | `/api/suggestions?date=` | open Hubstaff to-dos and Jira issues ranked for the catch-up plan |
| POST | `/api/check?date=` | same as status, plus sends the toast |
| GET | `/api/tasks?date=` | tasks for the day |
| POST | `/api/tasks` | `{ date, title, estimateHours }` |
| PATCH | `/api/tasks/:id` | any of `title`, `estimateHours`, `done` |
| DELETE | `/api/tasks/:id` | |

Example while the server runs:

```
curl "http://localhost:3939/api/status?date=2026-09-29"
```

## Things worth knowing

- The Hubstaff desktop client uploads activity in batches with a lag of about ten minutes,
  so "today" is always slightly behind.
- Hubstaff allows 5 token refreshes per hour per token. The access token is cached for its
  full lifetime, so normal use never gets near that.
- Days are the machine's local date. Hubstaff groups daily activity by the organization's
  timezone, so the two should match (or be close enough that midnight is not a working hour).
- Org and user ids are looked up once per process. Restart the server after changing them.

## Ideas for later

- Weekly view with a bar per day (add a `/api/week` route that loops `evaluateDate`).
- Carry unfinished catch-up tasks to the next day.
- Push the toast to your phone through a webhook instead of the desktop.
