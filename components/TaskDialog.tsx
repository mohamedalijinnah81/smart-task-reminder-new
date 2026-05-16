// components/TaskDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Task, TaskStatus } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    title: "", description: "", due_date: "", due_time: "",
    priority: "5", status: "todo" as TaskStatus, label: "", user_email: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task && open) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        due_date: (() => { try { return new Date(task.due_date).toISOString().split("T")[0]; } catch { return String(task.due_date); } })(),
        due_time: task.due_time ?? "",
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
          due_time: form.due_time || null,
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

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-white"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-base">Edit Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Title</Label>
            <Input value={form.title} onChange={f("title")} className="border-gray-300" />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</Label>
            <Textarea rows={2} value={form.description} onChange={f("description")} className="border-gray-300 resize-none text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={f("due_date")} className="border-gray-300" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Due Time</Label>
              <Input type="time" value={form.due_time} onChange={f("due_time")} className="border-gray-300" placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                <SelectTrigger className="border-gray-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} — {n >= 8 ? "High" : n >= 5 ? "Medium" : "Low"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as TaskStatus }))}>
                <SelectTrigger className="border-gray-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Label</Label>
              <Input placeholder="e.g. Calls, Finance…" value={form.label} onChange={f("label")} className="border-gray-300" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reminder Email</Label>
              <Input type="email" value={form.user_email} onChange={f("user_email")} className="border-gray-300" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="border-gray-300">Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="text-white" style={{ background: "#0052cc" }}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}