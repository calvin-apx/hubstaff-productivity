// Minimal Hubstaff v2 API client: bearer auth, one retry on 401, cursor pagination.
// API reference: https://developer.hubstaff.com/reference/
export class HubstaffClient {
  constructor({ apiBase, tokens }) {
    this.apiBase = apiBase;
    this.tokens = tokens;
  }

  async get(path, params = {}) {
    const url = new URL(this.apiBase + path);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(`${key}[]`, v));
      else url.searchParams.set(key, value);
    }
    let token = await this.tokens.getAccessToken();
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      token = await this.tokens.forceRefresh(token);
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body.error || body.message || res.statusText;
      throw new Error(`Hubstaff GET ${path} failed (${res.status}): ${reason}`);
    }
    return body;
  }

  // Follows cursor pagination and returns every page body. Pages carry
  // pagination.next_page_start_id until the last one.
  async getPages(path, params = {}) {
    const pages = [];
    let pageStartId;
    do {
      const body = await this.get(path, { ...params, page_limit: 500, page_start_id: pageStartId });
      pages.push(body);
      pageStartId = body.pagination?.next_page_start_id;
    } while (pageStartId);
    return pages;
  }

  async getList(path, key, params = {}) {
    const pages = await this.getPages(path, params);
    return pages.flatMap((page) => page[key] || []);
  }

  // Like getList, plus the project and task names Hubstaff side-loads through "include".
  async getListWithNames(path, key, params = {}, include = ["projects", "tasks"]) {
    const pages = await this.getPages(path, { ...params, include });
    const names = { projects: new Map(), tasks: new Map() };
    for (const page of pages) {
      for (const p of page.projects || []) names.projects.set(p.id, p.name);
      for (const t of page.tasks || []) names.tasks.set(t.id, t.summary);
    }
    return { items: pages.flatMap((page) => page[key] || []), names };
  }
}

export const getMe = (client) => client.get("/users/me").then((body) => body.user);
export const getOrganizations = (client) => client.getList("/organizations", "organizations");
export const getProjects = (client, orgId) => client.getList(`/organizations/${orgId}/projects`, "projects");

// Daily totals between two dates (both inclusive): one row per date, project and task, all
// fields in seconds (tracked, overall, keyboard, mouse, input_tracked, manual, idle).
// "date" is the organization's date.
export const getDailyActivities = (client, orgId, { start, stop, userId }) =>
  client.getListWithNames(`/organizations/${orgId}/activities/daily`, "daily_activities", {
    "date[start]": start,
    "date[stop]": stop,
    user_ids: [userId],
  });

// Open to-dos. With userId only tasks assigned to that user; with projectIds only those projects.
// Task fields: id, summary, details, status, project_id, assignee_ids, due_at, updated_at.
export const getOpenTasks = (client, orgId, { userId, projectIds } = {}) =>
  client.getListWithNames(
    `/organizations/${orgId}/tasks`,
    "tasks",
    { status: ["active"], user_ids: userId ? [userId] : undefined, project_ids: projectIds },
    ["projects"]
  );

// Ten-minute slots between two instants (stop is exclusive). Each has time_slot (slot start),
// starts_at (first activity inside the slot), tracked/overall seconds, project_id and task_id.
export const getActivities = (client, orgId, { start, stop, userId }) =>
  client.getListWithNames(`/organizations/${orgId}/activities`, "activities", {
    "time_slot[start]": start,
    "time_slot[stop]": stop,
    user_ids: [userId],
  });
