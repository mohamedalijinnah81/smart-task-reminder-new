// components/TaskCard.tsx
"use client";

import { Task, TaskStatus } from "@/lib/types";
import { format, differenceInCalendarDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal, Pencil, Trash2, ArrowRight, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function priorityBar(priority: number) {
  if (priority >= 8) return { color: "#ef4444", label: "High" };
  if (priority >= 5) return { color: "#f59e0b", label: "Medium" };
  return { color: "#22c55e", label: "Low" };
}

function dueDateInfo(dueDate: string | Date, status: TaskStatus) {
  if (status === "done") return null;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, bg: "#fecaca", text: "#b91c1c", icon: AlertCircle };
  if (diff === 0) return { label: "Due today", bg: "#fed7aa", text: "#c2410c", icon: Clock };
  if (diff <= 2) return { label: `${diff}d left`, bg: "#fef08a", text: "#854d0e", icon: Clock };
  return null;
}

const TRANSITIONS: Record<TaskStatus, { label: string; value: TaskStatus }[]> = {
  todo: [{ label: "Move to In Progress", value: "in_progress" }],
  in_progress: [
    { label: "Move to To Do", value: "todo" },
    { label: "Mark as Done ✓", value: "done" },
  ],
  done: [{ label: "Reopen", value: "todo" }],
};

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }: Props) {
  const prio = priorityBar(task.priority);
  const due = dueDateInfo(task.due_date, task.status);

  const formattedDate = (() => {
    try { return format(new Date(task.due_date), "MMM d"); } catch { return ""; }
  })();

  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-gray-200 group cursor-pointer hover:shadow-md transition-shadow",
        task.status === "done" && "opacity-60"
      )}
      style={{ borderLeft: `3px solid ${prio.color}` }}
    >
      {/* Priority color bar at top — Trello label style */}
      <div
        className="h-2 rounded-t-lg w-full"
        style={{ background: prio.color, opacity: 0.15 }}
      />

      <div className="px-3 py-2.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {task.status === "done" && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
            )}
            <p className={cn(
              "text-sm text-gray-800 leading-snug break-words",
              task.status === "done" && "line-through text-gray-400"
            )}>
              {task.title}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 -mr-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {TRANSITIONS[task.status].map((t) => (
                <DropdownMenuItem key={t.value} onClick={() => onStatusChange(task, t.value)}>
                  <ArrowRight className="w-3.5 h-3.5 mr-2" />
                  {t.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Edit task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(task)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description snippet */}
        {task.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        )}

        {/* Footer chips */}
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          {/* Due date */}
          {due ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ background: due.bg, color: due.text }}
            >
              <due.icon className="w-3 h-3" />
              {due.label}
            </span>
          ) : (
            <span className="text-xs text-gray-400">{formattedDate}</span>
          )}

          {/* Priority chip */}
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: prio.color + "20", color: prio.color }}
          >
            {prio.label} · {task.priority}
          </span>

          {/* Label chip */}
          {task.label && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
              {task.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}