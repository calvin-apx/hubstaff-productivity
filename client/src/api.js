// Thin wrappers around the server API. Each call returns parsed JSON or throws an Error
// carrying the server's message, so components only need one catch.
async function request(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

export const api = {
  config: () => request("/api/config"),
  status: (date) => request(`/api/status?date=${date}`),
  suggestions: (date) => request(`/api/suggestions?date=${date}`),
  check: (date) => request(`/api/check?date=${date}`, { method: "POST" }),
  tasks: (date) => request(`/api/tasks?date=${date}`),
  addTask: (task) => request("/api/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id, patch) => request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
};
