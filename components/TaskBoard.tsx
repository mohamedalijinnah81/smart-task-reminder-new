// components/TaskBoard.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "./AppShelll";
import TaskCard from "./TaskCard";
import TaskDialog from "./TaskDialog";
import AITaskInput from "./AITaskInput";
import { Task, TaskStatus, AIParsedTask } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [prefillTask, setPrefillTask] = useState<AIParsedTask | null>(null);
  // Mobile: which column tab is active
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
  }, [fetchTasks]);

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const handleEdit = (task: Task) => {
    setEditTask(task);
    setPrefillTask(null);
    setDialogOpen(true);
  };

  const handleAIParsed = (parsed: AIParsedTask) => {
    setPrefillTask(parsed);
    setEditTask(null);
    setDialogOpen(true);
    toast.success("Task parsed! Review and confirm.");
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditTask(null);
    setPrefillTask(null);
  };

  const handleSaved = () => {
    fetchTasks();
    handleDialogClose();
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => b.priority - a.priority);

  const activeTasks = tasks.filter((t) => t.status !== "done").length;

  return (
    <AppShell>
      <div className="max-w-screen-xl mx-auto w-full px-4 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Task Board</h1>
            <p className="text-sm text-muted-foreground">
              {activeTasks} active {activeTasks === 1 ? "task" : "tasks"}
            </p>
          </div>
          <Button onClick={() => { setPrefillTask(null); setEditTask(null); setDialogOpen(true); }} size="sm" className="gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </Button>
        </div>

        {/* AI Task Input */}
        <AITaskInput onParsed={handleAIParsed} />

        {/* Board */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Mobile: tab switcher ── */}
            <div className="flex md:hidden border-b gap-0">
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  onClick={() => setMobileCol(col.id)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium transition-colors border-b-2",
                    mobileCol === col.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {col.label}
                  <span className="ml-1.5 text-xs opacity-60">
                    ({tasksByStatus(col.id).length})
                  </span>
                </button>
              ))}
            </div>

            {/* ── Mobile: single column view ── */}
            <div className="flex flex-col gap-2 md:hidden">
              {tasksByStatus(mobileCol).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
              {tasksByStatus(mobileCol).length === 0 && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                  No tasks here
                </div>
              )}
            </div>

            {/* ── Desktop: 3-column kanban ── */}
            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col gap-3 min-w-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                      {tasksByStatus(col.id).length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 min-h-[120px]">
                    {tasksByStatus(col.id).map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                    {tasksByStatus(col.id).length === 0 && (
                      <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                        Empty
                      </div>
                    )}
                  </div>

                  {col.id === "todo" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground justify-start"
                      onClick={() => { setPrefillTask(null); setEditTask(null); setDialogOpen(true); }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add task
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        task={editTask}
        prefill={prefillTask}
        onClose={handleDialogClose}
        onSaved={handleSaved}
      />
    </AppShell>
  );
}