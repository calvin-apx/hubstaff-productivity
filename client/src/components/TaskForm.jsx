import { useEffect, useRef, useState } from "react";

// draft = { title, at } is set by the "Plan" buttons; "at" changes so the same title can be
// planned twice in a row.
export default function TaskForm({ onAdd, draft }) {
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("1");
  const hoursInput = useRef(null);

  useEffect(() => {
    if (!draft?.title) return;
    setTitle(draft.title);
    hoursInput.current?.focus();
    hoursInput.current?.select();
  }, [draft]);

  async function submit(event) {
    event.preventDefault();
    const estimateHours = Number(hours);
    if (!title.trim() || !(estimateHours > 0)) return;
    await onAdd({ title: title.trim(), estimateHours });
    setTitle("");
    setHours("1");
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What will you do?" required />
      <input
        ref={hoursInput}
        type="number"
        min="0.25"
        step="0.25"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        aria-label="Estimated hours"
      />
      <button type="submit">Add</button>
    </form>
  );
}
