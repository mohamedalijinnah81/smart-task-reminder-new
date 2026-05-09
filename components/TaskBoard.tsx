// components/TaskBoard.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "./AppShelll";
import TaskCard from "./TaskCard";
import TaskDialog from "./TaskDialog";
import { Task, TaskStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "To Do", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-50 dark:bg-blue-950" },
  { id: "done", label: "Done", color: "bg-green-50 dark:bg-green-950" },
];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      toast("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      toast("Failed to update task");
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast("Task deleted");
    } catch {
      toast("Failed to delete task");
    }
  };

  const handleEdit = (task: Task) => {
    setEditTask(task);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditTask(null);
  };

  const handleSaved = () => {
    fetchTasks();
    handleDialogClose();
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => b.priority - a.priority);

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Task Board</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tasks.filter((t) => t.status !== "done").length} active tasks
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${col.color}`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs bg-white dark:bg-black/20 text-muted-foreground rounded-full px-2 py-0.5 font-medium">
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
                      No tasks
                    </div>
                  )}
                </div>

                {/* Quick-add for To Do */}
                {col.id === "todo" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground justify-start"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add task
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        task={editTask}
        onClose={handleDialogClose}
        onSaved={handleSaved}
      />
    </AppShell>
  );
}