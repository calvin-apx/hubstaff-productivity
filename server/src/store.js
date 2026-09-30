// Tiny JSON file store for catch-up tasks: data/tasks.json
// Shape: { tasks: [ { id, date, title, estimateHours, done, createdAt } ] }
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

const FILE = path.join(config.dataDir, "tasks.json");

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { tasks: [] };
  }
}

function write(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function listTasks(date) {
  return read().tasks.filter((t) => t.date === date);
}

export function addTask({ date, title, estimateHours }) {
  const db = read();
  const task = { id: randomUUID(), date, title, estimateHours, done: false, createdAt: new Date().toISOString() };
  db.tasks.push(task);
  write(db);
  return task;
}

export function updateTask(id, patch) {
  const db = read();
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, patch);
  write(db);
  return task;
}

export function deleteTask(id) {
  const db = read();
  const before = db.tasks.length;
  db.tasks = db.tasks.filter((t) => t.id !== id);
  write(db);
  return db.tasks.length < before;
}
