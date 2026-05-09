// lib/types.ts

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string; // YYYY-MM-DD
  priority: number; // 1-10
  status: TaskStatus;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderLog {
  id: number;
  task_id: number;
  sent_at: string;
  type: "before_due" | "on_due" | "overdue";
}

export interface AppSetting {
  setting_key: string;
  setting_value: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  due_date: string;
  priority: number;
  status?: TaskStatus;
  user_email: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: number;
}