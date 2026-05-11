// app/tasks/page.tsx
import TaskBoard from "@/components/TaskBoard";
export const dynamic = "force-dynamic";
export default function TasksPage() {
  return <TaskBoard />;
}