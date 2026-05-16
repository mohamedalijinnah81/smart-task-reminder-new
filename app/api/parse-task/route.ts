// app/api/parse-task/route.ts
// Supports single OR multiple tasks from one input.
// Returns: { tasks: AIParsedTask[] }

import { NextRequest, NextResponse } from "next/server";
import { format, addDays } from "date-fns";

function getTodayAndTomorrow() {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  return {
    now,
    todayStr: format(now, "yyyy-MM-dd"),
    tomorrowStr: format(tomorrow, "yyyy-MM-dd"),
    timeStr: format(now, "HH:mm"),
    dayOfWeek: format(now, "EEEE"), // e.g. "Tuesday"
  };
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const { now, todayStr, tomorrowStr, timeStr, dayOfWeek } = getTodayAndTomorrow();

    // Pre-compute next 7 weekdays so the model doesn't have to calculate
    const weekdays: Record<string, string> = {};
    for (let i = 1; i <= 7; i++) {
      const d = addDays(now, i);
      weekdays[format(d, "EEEE")] = format(d, "yyyy-MM-dd");
    }
    const weekdayHint = Object.entries(weekdays)
      .map(([day, date]) => `  - "next ${day}" or "${day}" → ${date}`)
      .join("\n");

    const systemPrompt = `You are a task extraction assistant embedded in a task management app.
Your job: parse the user's input and extract one or more tasks as structured JSON.

=== CURRENT DATE/TIME ===
Today: ${todayStr} (${dayOfWeek})
Time:  ${timeStr}
Tomorrow: ${tomorrowStr}

=== WEEKDAY REFERENCE (use these exact dates) ===
${weekdayHint}

=== OUTPUT FORMAT ===
Always return a JSON object with a "tasks" array — even for a single task:
{
  "tasks": [
    {
      "title": "Short, clear task title",
      "description": null,
      "due_date": "YYYY-MM-DD",
      "due_time": null,
      "priority": 5,
      "label": null
    }
  ]
}

=== MULTIPLE TASKS ===
If the user mentions more than one task (e.g. "call John AND send the invoice"), create a separate task object for each one.
Comma-separated or "and"-separated tasks should each become their own task.

=== DUE DATE RULES (CRITICAL — follow exactly) ===
- If user says "today" → ${todayStr}
- If user says "tomorrow" → ${tomorrowStr}
- If user says a weekday (e.g. "Friday") → use the weekday reference above
- If user says "next week" → ${format(addDays(now, 7), "yyyy-MM-dd")}
- If user says "in X days" → compute from today
- If user says "by [date]" or "until [date]" or "on [date]" → parse that date
- If user gives NO date hint at all → default to ${tomorrowStr}
NEVER use a date from the settings or any other source. Only use what the user explicitly said or the default above.

=== DUE TIME RULES ===
- If user mentions a specific time (e.g. "at 3pm", "at 14:00", "at noon") → extract as "HH:MM" in 24h format
- "noon" → "12:00", "midnight" → "00:00", "3pm" → "15:00", "9am" → "09:00"
- If no time mentioned → null

=== PRIORITY RULES ===
- User says "urgent", "ASAP", "critical", "immediately", "emergency" → 9
- User says "important", "high priority", "soon", "as soon as possible" → 7
- User says nothing about priority → 5 (medium — this is the default)
- User says "low priority", "whenever", "no rush", "eventually" → 3
NEVER assign a random priority. Only 9, 7, 5, or 3 unless user gives a specific number.

=== LABEL RULES ===
Infer label ONLY when obviously clear from context:
- Contains "call", "phone", "ring" → "Calls"
- Contains "invoice", "payment", "finance", "bill", "tax" → "Finance"
- Contains "meeting", "standup", "sync" → "Meetings"
- Contains "email", "send", "reply" → "Email"
- Contains "doctor", "health", "gym", "exercise" → "Health"
- Contains "buy", "order", "purchase", "shop" → "Shopping"
- Otherwise → null

=== TITLE RULES ===
- Keep titles short and action-oriented (max ~60 chars)
- Start with a verb when possible: "Call Mr. Smith", "Send invoice to client"
- Don't include date/time in the title — those go in due_date/due_time

=== DESCRIPTION RULES ===
- Only add description if user provided extra context beyond the task itself
- Otherwise null`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text.trim() },
        ],
        response_format: { type: "json_object" },
        temperature: 0.0, // deterministic — we want exact rule-following
        max_tokens: 500,  // enough for up to ~5 tasks
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "OpenAI error");

    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    // Normalise: handle both { tasks: [...] } and legacy single-object responses
    let tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [parsed];

    tasks = tasks
      .filter((t: Record<string, unknown>) => t && typeof t.title === "string" && t.title.trim())
      .map((t: Record<string, unknown>) => ({
        title: String(t.title).trim(),
        description: t.description ? String(t.description) : null,
        due_date: typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)
          ? t.due_date
          : tomorrowStr,
        due_time: typeof t.due_time === "string" && /^\d{2}:\d{2}$/.test(t.due_time)
          ? t.due_time
          : null,
        priority: Math.min(10, Math.max(1, parseInt(String(t.priority)) || 5)),
        label: t.label ? String(t.label) : null,
      }));

    if (!tasks.length) throw new Error("Could not extract any tasks from input");

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("parse-task error:", error);
    return NextResponse.json({ error: "Failed to parse task" }, { status: 500 });
  }
}