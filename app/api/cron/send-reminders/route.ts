// app/api/cron/send-reminders/route.ts
// Runs daily at the reminder_time set in settings (via vercel.json schedule).
// Uses due_time on tasks to send reminders closer to the actual deadline.

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { sendEmail, buildReminderEmail } from "@/lib/mailer";
import { format, differenceInCalendarDays } from "date-fns";
import { RowDataPacket } from "mysql2";
import { Task } from "@/lib/types";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load settings
    const [settingRows] = await pool.execute<RowDataPacket[]>(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('reminder_days_before', 'reminder_time')"
    );
    const settings: Record<string, string> = {};
    for (const r of settingRows as { setting_key: string; setting_value: string }[]) {
      settings[r.setting_key] = r.setting_value ?? "";
    }
    const daysBefore = parseInt(settings["reminder_days_before"] ?? "2");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = format(today, "yyyy-MM-dd");

    // Fetch all incomplete tasks
    const [tasks] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM tasks WHERE status != 'done' ORDER BY priority DESC"
    );

    const results = { sent: 0, skipped: 0, errors: 0 };

    for (const taskRow of tasks as Task[]) {
      try {
        const dueDate = new Date(taskRow.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = differenceInCalendarDays(dueDate, today);

        let reminderType: "before_due" | "on_due" | "overdue" | null = null;

        if (daysUntilDue === daysBefore) {
          reminderType = "before_due";
        } else if (daysUntilDue === 0) {
          reminderType = "on_due";
        } else if (daysUntilDue < 0) {
          reminderType = "overdue";
        }

        if (!reminderType) { results.skipped++; continue; }

        // Avoid duplicate sends on same day
        const [alreadySent] = await pool.execute<RowDataPacket[]>(
          "SELECT id FROM reminder_logs WHERE task_id = ? AND type = ? AND DATE(sent_at) = ?",
          [taskRow.id, reminderType, todayStr]
        );
        if ((alreadySent as RowDataPacket[]).length > 0) { results.skipped++; continue; }

        // Format due date and time for email
        const formattedDate = format(dueDate, "MMMM d, yyyy");
        const formattedTime = taskRow.due_time
          ? (() => {
              // Convert "HH:MM" to "h:mm AM/PM"
              const [h, m] = taskRow.due_time.split(":").map(Number);
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
            })()
          : null;

        const { subject, html } = buildReminderEmail({
          taskTitle: taskRow.title,
          dueDate: formattedDate,
          dueTime: formattedTime,
          priority: taskRow.priority,
          label: taskRow.label,
          type: reminderType,
          description: taskRow.description,
        });

        await sendEmail({ to: taskRow.user_email, subject, html });

        await pool.execute(
          "INSERT INTO reminder_logs (task_id, type) VALUES (?, ?)",
          [taskRow.id, reminderType]
        );

        results.sent++;
      } catch (err) {
        console.error(`Error processing task ${taskRow.id}:`, err);
        results.errors++;
      }
    }

    console.log(`[Cron] ${JSON.stringify(results)}`);
    return NextResponse.json({ success: true, ...results, date: todayStr });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}