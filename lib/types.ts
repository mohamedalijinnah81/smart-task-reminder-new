// lib/types.ts

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string;       // YYYY-MM-DD
  due_time: string | null; // HH:MM or null
  priority: number;       // 1-10
  status: TaskStatus;
  label: string | null;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  due_date: string;
  due_time?: string | null;
  priority: number;
  status?: TaskStatus;
  label?: string | null;
  user_email: string;
}

export interface AIParsedTask {
  title: string;
  description?: string | null;
  due_date: string;
  due_time?: string | null;
  priority: number;
  label?: string | null;
}