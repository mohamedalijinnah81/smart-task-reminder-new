// app/api/parse-task/route.ts
// Supports single OR multiple tasks from one input.
// Logs every call to parse_logs table for client debugging.
// Returns: { tasks: AIParsedTask[] }

import { NextRequest, NextResponse } from "next/server";
import { format, addDays } from "date-fns";
import pool from "@/lib/db";

function getDateContext() {
  const now = new Date();
  const tomorrow = addDays(now, 1);

  // Pre-compute next 7 weekday dates so the model never has to calculate them
  const weekdays: Record<string, string> = {};
  for (let i = 1; i <= 7; i++) {
    const d = addDays(now, i);
    weekdays[format(d, "EEEE")] = format(d, "yyyy-MM-dd");
  }
  const weekdayHint = Object.entries(weekdays)
    .map(([day, date]) => `  - "${day}" → ${date}`)
    .join("\n");

  return {
    now,
    todayStr: format(now, "yyyy-MM-dd"),
    tomorrowStr: format(tomorrow, "yyyy-MM-dd"),
    timeStr: format(now, "HH:mm"),
    dayOfWeek: format(now, "EEEE"),
    nextWeekStr: format(addDays(now, 7), "yyyy-MM-dd"),
    weekdayHint,
  };
}

function buildPrompt(ctx: ReturnType<typeof getDateContext>): string {
  return `You are a task extraction assistant embedded in a task management app.
Your job: parse the user's input and extract one or more tasks as structured JSON.

=== CURRENT DATE/TIME ===
Today: ${ctx.todayStr} (${ctx.dayOfWeek})
Time:  ${ctx.timeStr}
Tomorrow: ${ctx.tomorrowStr}

=== WEEKDAY REFERENCE (use these exact dates — do not calculate yourself) ===
${ctx.weekdayHint}

=== OUTPUT FORMAT ===
Always return a JSON object with a "tasks" array — even for a single task:
{
  "tasks": [
    {
      "title": "Short, action-oriented task title (max 60 chars)",
      "description": null,
      "due_date": "YYYY-MM-DD",
      "due_time": null,
      "priority": 5,
      "label": null
    }
  ]
}

=== MULTIPLE TASKS ===
If the user mentions more than one task (connected by "and", "also", ",", "then", "plus"), create a separate task object for each.

=== TITLE AND DESCRIPTION RULES ===
- Title must be short and action-oriented (max 60 chars). Start with a verb: "Call Mr. Smith", "Send invoice to client".
- Do NOT include date or time in the title — those go in due_date/due_time fields.
- IMPORTANT: If the user's input contains more detail than fits in a 60-char title, put the FULL remaining context into the "description" field. Never discard information the user provided — overflow goes to description, not to /dev/null.
- If there is no extra detail beyond the title, description = null.

=== PRIORITY RULES ===
Priority is an integer from 1 to 10. Follow this order strictly:

1. EXPLICIT NUMBER — highest priority rule. If the user says a number (e.g. "priority 8", "priority 4", "level 6"), use EXACTLY that number. Do not round or map it to anything else.
2. EXPLICIT KEYWORD MAPPING — use these only when no number is given:
   - "urgent", "ASAP", "critical", "immediately", "emergency" → 9
   - "very important", "high priority", "top priority" → 8
   - "important", "soon", "as soon as possible" → 7
   - nothing mentioned → 5 (default)
   - "low priority", "whenever", "no rush", "eventually", "not urgent" → 3
3. FREE-FORM — if the user uses urgency language not in the list above, use your judgment on the 1–10 scale.

The allowed output range is 1–10 (any integer). Do NOT restrict yourself to only [3, 5, 7, 9].

=== DUE DATE RULES (follow exactly — never guess or use settings values) ===
- "today" → ${ctx.todayStr}
- "tomorrow" → ${ctx.tomorrowStr}
- A weekday name (e.g. "Friday", "Monday") → look up the weekday reference table above
- "next week" → ${ctx.nextWeekStr}
- "in X days" → compute X days from today
- "by [date]", "until [date]", "on [date]" → parse that specific date
- No date hint from user → default to ${ctx.tomorrowStr}

=== DUE TIME RULES ===
- If user mentions a time → extract as "HH:MM" (24h format)
- "noon" → "12:00", "midnight" → "00:00", "3pm" → "15:00", "9am" → "09:00", "half past 2" → "14:30"
- No time mentioned → null

=== LABEL RULES (infer only when obviously clear) ===
- "call", "phone", "ring", "contact" → "Calls"
- "invoice", "payment", "bill", "tax", "finance", "money" → "Finance"
- "meeting", "standup", "sync", "interview" → "Meetings"
- "email", "send", "reply", "message" → "Email"
- "doctor", "health", "gym", "exercise", "dentist" → "Health"
- "buy", "order", "purchase", "shop" → "Shopping"
- Otherwise → null`;
}

async function writeLog({
  userInput,
  llmRaw,
  finalTasks,
  error,
  model,
  durationMs,
}: {
  userInput: string;
  llmRaw?: string;
  finalTasks?: unknown[];
  error?: string;
  model?: string;
  durationMs?: number;
}) {
  try {
    await pool.execute(
      `INSERT INTO parse_logs (user_input, llm_raw, final_tasks, error, model, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userInput,
        llmRaw ?? null,
        finalTasks ? JSON.stringify(finalTasks) : null,
        error ?? null,
        model ?? null,
        durationMs ?? null,
      ]
    );
  } catch (logErr) {
    // Never let logging crash the main request
    console.error("[parse-task] Failed to write parse_log:", logErr);
  }
}

const MODEL = "gpt-4o-mini";

export async function POST(req: NextRequest) {
  let userInput = "";
  let llmRaw: string | undefined;

  try {
    const body = await req.json();
    userInput = (body.text ?? "").trim();

    if (!userInput) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const ctx = getDateContext();
    const systemPrompt = buildPrompt(ctx);

    // ── Call the LLM ──────────────────────────────────────────────────
    const t0 = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
        max_tokens: 600,
      }),
    });
    const durationMs = Date.now() - t0;

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "OpenAI error");

    // ── Capture raw LLM output ────────────────────────────────────────
    llmRaw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(llmRaw || "{}");

    // ── Normalise output ──────────────────────────────────────────────
    // Handle both { tasks: [...] } and legacy single-object responses
    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [parsed];

    const finalTasks = rawTasks
      .filter((t: Record<string, unknown>) => t && typeof t.title === "string" && t.title.trim())
      .map((t: Record<string, unknown>) => ({
        title: String(t.title).trim(),
        description: t.description ? String(t.description) : null,
        due_date:
          typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)
            ? t.due_date
            : ctx.tomorrowStr,
        due_time:
          typeof t.due_time === "string" && /^\d{2}:\d{2}$/.test(t.due_time)
            ? t.due_time
            : null,
        priority: Math.min(10, Math.max(1, parseInt(String(t.priority)) || 5)),
        label: t.label ? String(t.label) : null,
      }));

    if (!finalTasks.length) throw new Error("Could not extract any tasks from input");

    // ── Log: success ──────────────────────────────────────────────────
    await writeLog({ userInput, llmRaw, finalTasks, model: MODEL, durationMs });

    return NextResponse.json({ tasks: finalTasks });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[parse-task] Error:", errMsg);

    // ── Log: failure ──────────────────────────────────────────────────
    await writeLog({ userInput, llmRaw, error: errMsg, model: MODEL });

    return NextResponse.json({ error: "Failed to parse task" }, { status: 500 });
  }
}