// lib/mailer.ts
import nodemailer from "nodemailer";
import pool from "./db";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
}

async function getSmtpConfig(): Promise<SmtpConfig> {
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM app_settings 
     WHERE setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_name')`
  );

  const settings: Record<string, string> = {};
  for (const row of rows as { setting_key: string; setting_value: string }[]) {
    settings[row.setting_key] = row.setting_value ?? "";
  }

  return {
    host: settings["smtp_host"] || process.env.SMTP_HOST || "",
    port: parseInt(settings["smtp_port"] || process.env.SMTP_PORT || "587"),
    user: settings["smtp_user"] || process.env.SMTP_USER || "",
    pass: settings["smtp_pass"] || process.env.SMTP_PASS || "",
    fromName: settings["smtp_from_name"] || "Task Reminder",
  };
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const cfg = await getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });

  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.user}>`,
    to,
    subject,
    html,
  });
}

export function buildReminderEmail({
  taskTitle,
  dueDate,
  priority,
  type,
  description,
}: {
  taskTitle: string;
  dueDate: string;
  priority: number;
  type: "before_due" | "on_due" | "overdue";
  description?: string | null;
}): { subject: string; html: string } {
  const priorityLabel =
    priority >= 8 ? "🔴 High" : priority >= 5 ? "🟡 Medium" : "🟢 Low";

  const messages = {
    before_due: {
      subject: `⏰ Upcoming Task: "${taskTitle}" is due soon`,
      headline: "Task Due Soon",
      body: `Your task is coming up! Make sure you complete it before the due date.`,
    },
    on_due: {
      subject: `📅 Due Today: "${taskTitle}"`,
      headline: "Task Due Today",
      body: `Your task is due today. Don't forget to mark it as done once completed!`,
    },
    overdue: {
      subject: `🚨 Overdue Task: "${taskTitle}" — action required`,
      headline: "Task Overdue",
      body: `This task is past its due date and still not marked as done. Please take action immediately.`,
    },
  };

  const msg = messages[type];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 24px; }
        .card { background: #fff; border-radius: 12px; max-width: 520px; margin: 0 auto; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
        .badge-before_due { background: #fef9c3; color: #854d0e; }
        .badge-on_due { background: #dbeafe; color: #1e40af; }
        .badge-overdue { background: #fee2e2; color: #991b1b; }
        h1 { font-size: 22px; margin: 0 0 8px; color: #111; }
        p { color: #555; line-height: 1.6; margin: 0 0 16px; }
        .task-block { background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #6366f1; }
        .task-title { font-size: 18px; font-weight: 700; color: #111; margin: 0 0 6px; }
        .meta { font-size: 13px; color: #777; }
        .cta { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .footer { margin-top: 24px; font-size: 12px; color: #aaa; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge badge-${type}">${msg.headline}</span>
        <h1>${msg.headline}</h1>
        <p>${msg.body}</p>
        <div class="task-block">
          <div class="task-title">${taskTitle}</div>
          ${description ? `<p style="margin:6px 0 8px;color:#555;font-size:14px;">${description}</p>` : ""}
          <div class="meta">📅 Due: <strong>${dueDate}</strong> &nbsp;|&nbsp; Priority: <strong>${priorityLabel} (${priority}/10)</strong></div>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/tasks" class="cta">View Tasks →</a>
        <div class="footer">You're receiving this because a task was assigned to you. Visit the app to manage your tasks.</div>
      </div>
    </body>
    </html>
  `;

  return { subject: msg.subject, html };
}