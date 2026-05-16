// lib/mailer.ts
import nodemailer from "nodemailer";
import pool from "./db";

async function getSmtpConfig() {
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM app_settings
     WHERE setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_name')`
  );
  const s: Record<string, string> = {};
  for (const row of rows as { setting_key: string; setting_value: string }[]) {
    s[row.setting_key] = row.setting_value ?? "";
  }
  return {
    host: s["smtp_host"] || process.env.SMTP_HOST || "",
    port: parseInt(s["smtp_port"] || process.env.SMTP_PORT || "587"),
    user: s["smtp_user"] || process.env.SMTP_USER || "",
    pass: s["smtp_pass"] || process.env.SMTP_PASS || "",
    fromName: s["smtp_from_name"] || "TaskChaser",
  };
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const cfg = await getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({ from: `"${cfg.fromName}" <${cfg.user}>`, to, subject, html });
}

export function buildReminderEmail({
  taskTitle, dueDate, dueTime, priority, label, type, description,
}: {
  taskTitle: string;
  dueDate: string;
  dueTime?: string | null;
  priority: number;
  label?: string | null;
  type: "before_due" | "on_due" | "overdue";
  description?: string | null;
}): { subject: string; html: string } {
  const prioLabel = priority >= 8 ? "🔴 High" : priority >= 5 ? "🟡 Medium" : "🟢 Low";
  const timeStr = dueTime ? ` at ${dueTime}` : "";

  const msgs = {
    before_due: { subject: `⏰ Upcoming: "${taskTitle}"`, headline: "Task Due Soon", body: "Your task is coming up. Complete it before the deadline." },
    on_due:     { subject: `📅 Due Today: "${taskTitle}"`, headline: "Due Today", body: `Your task is due today${timeStr}. Mark it done when complete!` },
    overdue:    { subject: `🚨 Overdue: "${taskTitle}"`, headline: "Task Overdue", body: "This task is past its due date and still open. Take action now." },
  };
  const msg = msgs[type];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>body{font-family:-apple-system,sans-serif;background:#f1f2f4;margin:0;padding:24px}
  .card{background:#fff;border-radius:12px;max-width:520px;margin:0 auto;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:16px}
  .before_due{background:#dbeafe;color:#1e40af}.on_due{background:#fed7aa;color:#c2410c}.overdue{background:#fee2e2;color:#991b1b}
  h1{font-size:20px;margin:0 0 8px;color:#111}p{color:#555;line-height:1.6;margin:0 0 16px}
  .task{background:#f9fafb;border-radius:8px;padding:16px;border-left:4px solid #0052cc;margin:16px 0}
  .title{font-size:17px;font-weight:700;color:#111;margin:0 0 6px}.meta{font-size:13px;color:#777}
  .cta{display:inline-block;margin-top:20px;padding:12px 24px;background:#0052cc;color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600}
  .footer{margin-top:24px;font-size:12px;color:#aaa;text-align:center}</style></head><body>
  <div class="card">
    <span class="badge ${type}">${msg.headline}</span>
    <h1>${msg.headline}</h1><p>${msg.body}</p>
    <div class="task">
      <div class="title">${taskTitle}</div>
      ${description ? `<p style="margin:6px 0 8px;font-size:14px">${description}</p>` : ""}
      <div class="meta">
        📅 Due: <strong>${dueDate}${timeStr}</strong> &nbsp;|&nbsp;
        Priority: <strong>${prioLabel} (${priority}/10)</strong>
        ${label ? ` &nbsp;|&nbsp; Label: <strong>${label}</strong>` : ""}
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/tasks" class="cta">View Tasks →</a>
    <div class="footer">TaskChaser · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/tasks">Manage tasks</a></div>
  </div></body></html>`;

  return { subject: msg.subject, html };
}