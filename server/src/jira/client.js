// Optional Jira Cloud source for "what to do next". Enabled when JIRA_BASE_URL, JIRA_EMAIL and
// JIRA_API_TOKEN are all set. API token: https://id.atlassian.com/manage-profile/security/api-tokens
import { config } from "../config.js";

export const jiraEnabled = () => Boolean(config.jira.baseUrl && config.jira.email && config.jira.apiToken);

// Runs JIRA_JQL and returns a flat issue list. Uses the current search endpoint
// (GET /rest/api/3/search/jql); the older /rest/api/3/search is deprecated.
export async function searchIssues() {
  const { baseUrl, email, apiToken, jql } = config.jira;
  const url = new URL("/rest/api/3/search/jql", baseUrl);
  url.searchParams.set("jql", jql);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("fields", "summary,status,priority,duedate,updated,project");

  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64"),
      Accept: "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = (body.errorMessages || []).join("; ") || res.statusText;
    throw new Error(`Jira search failed (${res.status}): ${reason}`);
  }

  return (body.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || null,
    statusCategory: issue.fields.status?.statusCategory?.key || null, // new | indeterminate | done
    priority: issue.fields.priority?.name || null,
    dueAt: issue.fields.duedate || null,
    updatedAt: issue.fields.updated || null,
    project: issue.fields.project?.key || null,
    url: `${baseUrl}/browse/${issue.key}`,
  }));
}
