// components/TaskBoard.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "./AppShelll";
import TaskCard from "./TaskCard";
import TaskDialog from "./TaskDialog";
import AITaskInput from "./AITaskInput";
import { Task, TaskStatus } from "@/lib/types";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Trello column colors
const COLUMNS: {
  id: TaskStatus;
  label: string;
  headerBg: string;
  columnBg: string;
  count_bg: string;
}[] = [
  {
    id: "todo",
    label: "To Do",
    headerBg: "#0052cc",
    columnBg: "#e9f0ff",
    count_bg: "#cfe0ff",
  },
  {
    id: "in_progress",
    label: "In Progress",
    headerBg: "#f59e0b",
    columnBg: "#fffbeb",
    count_bg: "#fde68a",
  },
  {
    id: "done",
    label: "Done",
    headerBg: "#16a34a",
    columnBg: "#f0fdf4",
    count_bg: "#bbf7d0",
  },
];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultEmail, setDefaultEmail] = useState("");
  // Mobile tab
  const [mobileCol, setMobileCol] = useState<TaskStatus>("todo");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    // Load default email for AI task creation
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setDefaultEmail(d.settings?.default_user_email ?? ""))
      .catch(() => {});
  }, [fetchTasks]);

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to update task");
      fetchTasks(); // revert
    }
  };

  const handleDelete = async (task: Task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
      fetchTasks();
    }
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks
      .filter((t) => t.status === status)
      .sort((a, b) => b.priority - a.priority);

  const activeTasks = tasks.filter((t) => t.status !== "done").length;

  return (
    <AppShell>
      <div className="p-4 max-w-screen-xl mx-auto w-full space-y-4">
        {/* Board title row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">My Tasks</h1>
            <p className="text-xs text-gray-500">
              {activeTasks} active · {tasks.filter((t) => t.status === "done").length} done
            </p>
          </div>
        </div>

        {/* AI Fast-input bar */}
        <AITaskInput onCreated={fetchTasks} defaultEmail={defaultEmail} />

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* ── Mobile: tab switcher ── */}
            <div className="flex md:hidden border-b border-gray-200 bg-white rounded-t-lg overflow-hidden shadow-sm">
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  onClick={() => setMobileCol(col.id)}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2",
                    mobileCol === col.id
                      ? "border-b-2 text-white"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                  style={
                    mobileCol === col.id
                      ? { borderBottomColor: col.headerBg, background: col.headerBg }
                      : {}
                  }
                >
                  {col.label}
                  <span
                    className="ml-1.5 text-xs font-bold rounded-full px-1.5"
                    style={
                      mobileCol === col.id
                        ? { background: "rgba(255,255,255,0.3)" }
                        : { background: "#e5e7eb", color: "#6b7280" }
                    }
                  >
                    {tasksByStatus(col.id).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Mobile single column */}
            <div className="flex flex-col gap-2 md:hidden">
              {tasksByStatus(mobileCol).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onEdit={setEditTask}
                  onDelete={handleDelete}
                />
              ))}
              {tasksByStatus(mobileCol).length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
                  No tasks here
                </div>
              )}
            </div>

            {/* ── Desktop: 3-column Trello kanban ── */}
            <div className="hidden md:flex gap-4 items-start">
              {COLUMNS.map((col) => (
                <div
                  key={col.id}
                  className="flex-1 min-w-0 rounded-xl flex flex-col"
                  style={{ background: col.columnBg }}
                >
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
                    style={{ background: col.headerBg }}
                  >
                    <span className="text-sm font-bold text-white tracking-wide">
                      {col.label}
                    </span>
                    <span
                      className="text-xs font-bold rounded-full px-2 py-0.5"
                      style={{ background: col.count_bg, color: col.headerBg }}
                    >
                      {tasksByStatus(col.id).length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-3 min-h-[120px]">
                    {tasksByStatus(col.id).map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onEdit={setEditTask}
                        onDelete={handleDelete}
                      />
                    ))}
                    {tasksByStatus(col.id).length === 0 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                        Drop tasks here
                      </div>
                    )}
                  </div>

                  {/* Quick add hint at bottom of To Do */}
                  {col.id === "todo" && (
                    <div className="px-3 pb-3">
                      <button
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-gray-500 hover:bg-white/60 transition-colors"
                        onClick={() => {
                          // Focus the AI input at top
                          document.querySelector<HTMLInputElement>('input[placeholder*="Type a task"]')?.focus();
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add a task above ↑
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit dialog — only shown when user explicitly clicks Edit */}
      <TaskDialog
        open={!!editTask}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={() => { fetchTasks(); setEditTask(null); }}
      />
    </AppShell>
  );
}