// All tunable settings in one place. Values come from the root .env file (see .env.example).
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, "../..");
dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const env = process.env;
const num = (value, fallback) => (value === undefined || value === "" ? fallback : Number(value));
const bool = (value, fallback) => (value === undefined || value === "" ? fallback : value === "true");

export const config = {
  port: num(env.PORT, 3939),

  // Hubstaff API. Use a token created just for this app (see README, "Why a separate token").
  hubstaff: {
    pat: env.HUBSTAFF_PAT || "",
    apiBase: "https://api.hubstaff.com/v2",
    tokenUrl: "https://account.hubstaff.com/access_tokens",
    organizationId: env.HUBSTAFF_ORGANIZATION_ID ? Number(env.HUBSTAFF_ORGANIZATION_ID) : null,
    userId: env.HUBSTAFF_USER_ID ? Number(env.HUBSTAFF_USER_ID) : null,
  },

  // Optional Jira Cloud source for "what to do next". All three must be set to enable it.
  jira: {
    baseUrl: (env.JIRA_BASE_URL || "").replace(/\/$/, ""),
    email: env.JIRA_EMAIL || "",
    apiToken: env.JIRA_API_TOKEN || "",
    jql: env.JIRA_JQL || "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
    // Which statuses to show first. Matched case-insensitively as substrings, so a status named
    // "進行中(In Progress)" matches "In Progress". Unlisted statuses go last.
    statusOrder: (env.JIRA_STATUS_ORDER || "In Progress,To Do,Code Review,In Test,Blocked")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // Inputs to the productivity rule. The rule itself is in productivity.js.
  rule: {
    targetHours: num(env.TARGET_HOURS, 8),
    minActivityPercent: num(env.MIN_ACTIVITY_PERCENT, 50),
  },

  // Desktop notification schedule (see notify.js).
  notify: {
    after: env.NOTIFY_AFTER || "17:00", // local time, HH:MM
    checkIntervalMinutes: num(env.CHECK_INTERVAL_MINUTES, 30),
    whenProductive: bool(env.NOTIFY_WHEN_PRODUCTIVE, true),
  },

  // Where tasks.json and tokens.json are written. Git-ignored.
  dataDir: path.join(ROOT_DIR, "server", "data"),
};
