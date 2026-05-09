// components/TaskDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Task, TaskStatus } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}

const defaultForm = {
  title: "",
  description: "",
  due_date: "",
  priority: "5",
  status: "todo" as TaskStatus,
  user_email: "",
};

export default function TaskDialog({ open, task, onClose, onSaved }: TaskDialogProps) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  // Prefill default email from settings on mount
  useEffect(() => {
    async function loadDefaultEmail() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setForm((f) => ({
          ...f,
          user_email: data.settings?.default_user_email || "",
        }));
      } catch {
        // ignore
      }
    }
    if (open && !task) loadDefaultEmail();
  }, [open, task]);

  // Populate form when editing
  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        due_date: task.due_date,
        priority: String(task.priority),
        status: task.status,
        user_email: task.user_email,
      });
    } else {
      setForm((f) => ({ ...defaultForm, user_email: f.user_email }));
    }
  }, [task, open]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.due_date || !form.user_email.trim()) {
      toast("Title, due date, and email are required.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        due_date: form.due_date,
        priority: parseInt(form.priority),
        status: form.status,
        user_email: form.user_email.trim(),
      };

      const url = task ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = task ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save task");
      }

      toast(task ? "Task updated" : "Task created");
      onSaved();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Call Mr. Smith"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional notes…"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="priority">Priority (1–10)</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1)
                    .reverse()
                    .map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n >= 8 ? "— High" : n >= 5 ? "— Medium" : "— Low"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="user_email">Reminder Email *</Label>
            <Input
              id="user_email"
              type="email"
              placeholder="you@example.com"
              value={form.user_email}
              onChange={(e) => setForm({ ...form, user_email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Reminders will be sent to this address.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {task ? "Save Changes" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}