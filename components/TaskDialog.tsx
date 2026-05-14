// components/TaskDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Task, TaskStatus } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TaskDialog({ open, task, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "5",
    status: "todo" as TaskStatus,
    label: "",
    user_email: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task && open) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        due_date: (() => {
          try { return new Date(task.due_date).toISOString().split("T")[0]; }
          catch { return String(task.due_date); }
        })(),
        priority: String(task.priority),
        status: task.status,
        label: task.label ?? "",
        user_email: task.user_email,
      });
    }
  }, [task, open]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: form.due_date,
          priority: parseInt(form.priority),
          status: form.status,
          label: form.label.trim() || null,
          user_email: form.user_email.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task updated");
      onSaved();
    } catch {
      toast.error("Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-white"
        // No dark overlay — clean white modal
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-gray-900">Edit Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="title" className="text-gray-700">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border-gray-300"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="desc" className="text-gray-700">Description</Label>
            <Textarea
              id="desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border-gray-300 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-gray-700">Due Date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="border-gray-300"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-gray-700">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} — {n >= 8 ? "High" : n >= 5 ? "Medium" : "Low"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-gray-700">Label</Label>
              <Input
                placeholder="e.g. Work, Finance…"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="border-gray-300"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-gray-700">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-gray-700">Reminder Email</Label>
            <Input
              type="email"
              value={form.user_email}
              onChange={(e) => setForm({ ...form, user_email: e.target.value })}
              className="border-gray-300"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading} className="border-gray-300">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            style={{ background: "#0052cc" }}
            className="text-white hover:opacity-90"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}