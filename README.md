# TaskChaser — Smart Task Reminder

A Trello-inspired task manager with proactive email reminders. Built with Next.js 16, React 19, MySQL, and Nodemailer.

## Features

- **Kanban board** with To Do / In Progress / Done columns
- **Priority system** (1–10 scale) — cards sorted by priority within columns
- **Proactive reminders** via email:
  - N days before due date (configurable)
  - On the due date
  - Daily after overdue, until marked as done
- **Settings UI** to configure SMTP and default reminder email
- **Vercel Cron Job** — no separate service needed

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Install shadcn components

```bash
npx shadcn@latest init
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add textarea
npx shadcn@latest add dialog
npx shadcn@latest add select
npx shadcn@latest add badge
npx shadcn@latest add dropdown-menu
npx shadcn@latest add toast
npx shadcn@latest add separator
npx shadcn@latest add tooltip
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL connection
- `CRON_SECRET` — Random secret to protect the cron route
- `NEXT_PUBLIC_APP_URL` — Your deployed app URL (for email links)

SMTP credentials can be set via the Settings UI or via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

### 4. Run database migration

```bash
node scripts/migrate.js
```

This creates the `tasks`, `reminder_logs`, and `app_settings` tables.

### 5. Run locally

```bash
npm run dev
```

---

## Deployment on Vercel

1. Push to GitHub and import the repo in Vercel
2. Add all `.env.local` variables to Vercel Environment Variables
3. Set `CRON_SECRET` in Vercel — Vercel will automatically send `Authorization: Bearer <CRON_SECRET>` when invoking cron routes
4. The cron job in `vercel.json` runs daily at **08:00 UTC**

---

## Architecture

```
smart-task-reminder/
├── app/
│   ├── api/
│   │   ├── tasks/
│   │   │   ├── route.ts           # GET (list), POST (create)
│   │   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   │   ├── settings/route.ts      # GET, PUT
│   │   └── cron/
│   │       └── send-reminders/route.ts  # Vercel Cron Job
│   ├── tasks/page.tsx             # Kanban board page
│   ├── settings/page.tsx          # Settings page
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── AppShell.tsx               # Nav wrapper
│   ├── TaskBoard.tsx              # Kanban board
│   ├── TaskCard.tsx               # Individual task card
│   ├── TaskDialog.tsx             # Create/edit modal
│   └── SettingsForm.tsx           # Settings page UI
├── lib/
│   ├── db.ts                      # MySQL connection pool
│   ├── mailer.ts                  # Nodemailer + email templates
│   ├── types.ts                   # Shared TypeScript types
│   └── utils.ts                   # cn() utility
├── scripts/
│   └── migrate.js                 # DB migration script
├── vercel.json                    # Cron job schedule
└── .env.example
```

## Reminder Logic

The cron job at `/api/cron/send-reminders` runs daily and:

1. Fetches all tasks where `status != 'done'`
2. For each task, checks:
   - `daysUntilDue === reminder_days_before` → send **before_due** reminder
   - `daysUntilDue === 0` → send **on_due** reminder
   - `daysUntilDue < 0` → send **overdue** reminder (every day until done)
3. Checks `reminder_logs` to avoid duplicate sends per day per task per type
4. Sends email via Nodemailer and logs to `reminder_logs`

## Cron vs Separate Service

You **don't need** a separate Node.js cron service for Vercel. Vercel Cron Jobs invoke your API route on a schedule — it's fully serverless. The `vercel.json` config handles this:

```json
{
  "crons": [{ "path": "/api/cron/send-reminders", "schedule": "0 8 * * *" }]
}
```

To adjust the time, edit the cron schedule expression. All times are UTC.