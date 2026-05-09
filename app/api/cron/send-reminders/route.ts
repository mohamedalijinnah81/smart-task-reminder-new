// app/api/cron/send-reminders/route.ts
// Invoked daily at 08:00 UTC by Vercel Cron (see vercel.json)
// Protected by CRON_SECRET env var

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { sendEmail, buildReminderEmail } from "@/lib/mailer";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { RowDataPacket } from "mysql2";
import { Task } from "@/lib/types";

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get reminder_days_before setting
    const [settingRows] = await pool.execute<RowDataPacket[]>(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'reminder_days_before'"
    );
    const daysBefore = parseInt(
      (settingRows[0] as { setting_value: string })?.setting_value ?? "2"
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = format(today, "yyyy-MM-dd");

    // Fetch all non-done tasks
    const [tasks] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM tasks WHERE status != 'done' ORDER BY priority DESC`
    );

    const results = { sent: 0, skipped: 0, errors: 0 };

    for (const taskRow of tasks as Task[]) {
      try {
        const dueDate = new Date(taskRow.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = differenceInCalendarDays(dueDate, today);

        let reminderType: "before_due" | "on_due" | "overdue" | null = null;

        if (daysUntilDue === daysBefore) {
          // e.g. 2 days before — check if already sent today
          reminderType = "before_due";
        } else if (daysUntilDue === 0) {
          reminderType = "on_due";
        } else if (daysUntilDue < 0) {
          // Overdue — send every day until done
          reminderType = "overdue";
        }

        if (!reminderType) {
          results.skipped++;
          continue;
        }

        // Check if we've already sent this type of reminder today
        const [alreadySent] = await pool.execute<RowDataPacket[]>(
          `SELECT id FROM reminder_logs 
           WHERE task_id = ? AND type = ? AND DATE(sent_at) = ?`,
          [taskRow.id, reminderType, todayStr]
        );

        if ((alreadySent as RowDataPacket[]).length > 0) {
          results.skipped++;
          continue;
        }

        const { subject, html } = buildReminderEmail({
          taskTitle: taskRow.title,
          dueDate: format(new Date(taskRow.due_date), "MMMM d, yyyy"),
          priority: taskRow.priority,
          type: reminderType,
          description: taskRow.description,
        });

        await sendEmail({
          to: taskRow.user_email,
          subject,
          html,
        });

        // Log the reminder
        await pool.execute(
          `INSERT INTO reminder_logs (task_id, type) VALUES (?, ?)`,
          [taskRow.id, reminderType]
        );

        results.sent++;
      } catch (taskError) {
        console.error(`Error processing task ${taskRow.id}:`, taskError);
        results.errors++;
      }
    }

    console.log(`[Cron] Reminders: ${JSON.stringify(results)}`);
    return NextResponse.json({ success: true, ...results, date: todayStr });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}