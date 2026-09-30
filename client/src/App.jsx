import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { todayLocal } from "./dates.js";
import DateNav from "./components/DateNav.jsx";
import StatusCard from "./components/StatusCard.jsx";
import Suggestions from "./components/Suggestions.jsx";
import WorkedToday from "./components/WorkedToday.jsx";
import TaskForm from "./components/TaskForm.jsx";
import TaskList from "./components/TaskList.jsx";

export default function App() {
  const [date, setDate] = useState(todayLocal());
  const [status, setStatus] = useState(null); // GET /api/status
  const [suggestions, setSuggestions] = useState(null); // GET /api/suggestions
  const [suggestionsError, setSuggestionsError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState(null); // title pushed into the task form by "Plan"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  // Reload everything whenever the selected date changes. The three requests are independent,
  // so one failing does not blank the others.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuggestionsError("");
    const [statusRes, tasksRes, suggestRes] = await Promise.allSettled([
      api.status(date),
      api.tasks(date),
      api.suggestions(date),
    ]);
    if (statusRes.status === "fulfilled") setStatus(statusRes.value);
    else setError(statusRes.reason.message);
    if (tasksRes.status === "fulfilled") setTasks(tasksRes.value.tasks);
    else setError(tasksRes.reason.message);
    if (suggestRes.status === "fulfilled") setSuggestions(suggestRes.value);
    else {
      setSuggestions({ suggestions: [] });
      if (statusRes.status === "fulfilled") setSuggestionsError(suggestRes.reason.message);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  function showFlash(text) {
    setFlash(text);
    setTimeout(() => setFlash(""), 2500);
  }

  // Wraps a task action so any server error lands in the error banner.
  const guarded = (fn) => async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      setError(err.message);
    }
  };

  const addTask = guarded(async (task) => {
    const { task: created } = await api.addTask({ ...task, date });
    setTasks((prev) => [...prev, created]);
  });

  const toggleTask = guarded(async (task) => {
    const { task: updated } = await api.updateTask(task.id, { done: !task.done });
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  });

  const removeTask = guarded(async (id) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  });

  const checkNow = guarded(async () => {
    setStatus(await api.check(date));
    showFlash("Desktop notification sent");
  });

  const plan = (title) => setDraft({ title, at: Date.now() });
  const plannedHours = tasks.reduce((sum, t) => sum + t.estimateHours, 0);
  const doneHours = tasks.filter((t) => t.done).reduce((sum, t) => sum + t.estimateHours, 0);

  return (
    <main className="app">
      <header>
        <h1>Hubstaff Productivity</h1>
        <DateNav date={date} onChange={setDate} />
      </header>

      {error && <p className="error">{error}</p>}

      <StatusCard
        status={status}
        loading={loading}
        plannedHours={plannedHours}
        doneHours={doneHours}
        onRefresh={load}
        onCheck={checkNow}
      />

      <Suggestions
        data={suggestions}
        error={suggestionsError}
        gapHours={status?.evaluation.gapHours ?? 0}
        onPlan={plan}
      />

      <section className="card">
        <h2>Catch-up tasks</h2>
        <p className="muted">What you will do to make up the gap. Estimates are in hours.</p>
        <TaskForm onAdd={addTask} draft={draft} />
        <TaskList tasks={tasks} onToggle={toggleTask} onDelete={removeTask} />
      </section>

      <WorkedToday summary={status?.summary} timeline={status?.timeline || []} onPlan={plan} />

      {flash && <div className="flash">{flash}</div>}
    </main>
  );
}
