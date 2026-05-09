// components/TaskCard.tsx
"use client";

import { Task, TaskStatus } from "@/lib/types";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function getPriorityConfig(priority: number) {
  if (priority >= 8) return { label: "High", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
  if (priority >= 5) return { label: "Medium", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" };
  return { label: "Low", className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" };
}

function getDueDateConfig(dueDate: string, status: TaskStatus) {
  if (status === "done") return null;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(due, today);

  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, className: "text-red-600 dark:text-red-400", icon: AlertCircle };
  if (diff === 0) return { label: "Due today", className: "text-orange-600 dark:text-orange-400", icon: Clock };
  if (diff <= 2) return { label: `Due in ${diff}d`, className: "text-yellow-600 dark:text-yellow-400", icon: Clock };
  return null;
}

const STATUS_TRANSITIONS: Record<TaskStatus, { label: string; value: TaskStatus }[]> = {
  todo: [{ label: "Move to In Progress", value: "in_progress" }],
  in_progress: [
    { label: "Move to To Do", value: "todo" },
    { label: "Mark as Done", value: "done" },
  ],
  done: [{ label: "Reopen", value: "todo" }],
};

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) {
  const priorityConfig = getPriorityConfig(task.priority);
  const dueDateConfig = getDueDateConfig(task.due_date, task.status);
  const transitions = STATUS_TRANSITIONS[task.status];

  return (
    <div className={cn(
      "bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group",
      task.status === "done" && "opacity-60"
    )}>
      {/* Top row: title + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {task.status === "done" && (
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          )}
          <p className={cn(
            "text-sm font-medium leading-snug",
            task.status === "done" && "line-through text-muted-foreground"
          )}>
            {task.title}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {transitions.map((t) => (
              <DropdownMenuItem key={t.value} onClick={() => onStatusChange(task, t.value)}>
                <ArrowRight className="w-3.5 h-3.5 mr-2" />
                {t.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(task)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer: badges */}
      <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
        <Badge variant="outline" className={cn("text-xs px-1.5 py-0 font-medium", priorityConfig.className)}>
          {priorityConfig.label} ({task.priority})
        </Badge>

        <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
          {format(new Date(task.due_date), "MMM d")}
        </Badge>

        {dueDateConfig && (
          <Badge variant="outline" className={cn("text-xs px-1.5 py-0 font-medium flex items-center gap-1", dueDateConfig.className)}>
            <dueDateConfig.icon className="w-3 h-3" />
            {dueDateConfig.label}
          </Badge>
        )}
      </div>
    </div>
  );
}