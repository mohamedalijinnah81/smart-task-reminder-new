// app/api/parse-task/route.ts
import { NextRequest, NextResponse } from "next/server";
import { format, addHours } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const tomorrowStr = format(addHours(now, 24), "yyyy-MM-dd");

    const systemPrompt = `You are a lightning-fast task extraction assistant. Convert natural language into a task JSON object.

Today is ${todayStr}. Current time: ${format(now, "HH:mm")}.

DEFAULTS (use these when not specified by user):
- due_date: "${tomorrowStr}" (always default to next 24 hours if no date mentioned)
- priority: 5 (medium — only go higher if user says urgent/critical/ASAP/important)
- label: null (infer from context if obvious, e.g. "call" -> "Calls", "invoice/payment" -> "Finance")
- description: null

PRIORITY MAPPING:
- "urgent", "ASAP", "critical", "immediately" -> 9
- "important", "high priority", "soon" -> 7
- nothing mentioned -> 5 (medium)
- "whenever", "low priority", "no rush" -> 3

DATE PARSING (relative to today ${todayStr}):
- "tomorrow" -> ${tomorrowStr}
- "today" -> ${todayStr}
- "next week" -> 7 days from today
- "next [weekday]" -> compute correctly
- "in X days/hours" -> compute correctly
- No date mentioned -> ${tomorrowStr}

Return ONLY valid JSON, no markdown, no explanation:
{"title":"...","description":null,"due_date":"YYYY-MM-DD","priority":5,"label":null}`;

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
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "OpenAI error");

    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    if (!parsed.title) throw new Error("Could not extract task title");
    parsed.due_date = parsed.due_date || tomorrowStr;
    parsed.priority = Math.min(10, Math.max(1, parseInt(parsed.priority) || 5));
    parsed.description = parsed.description || null;
    parsed.label = parsed.label || null;

    return NextResponse.json({ task: parsed });
  } catch (error) {
    console.error("parse-task error:", error);
    return NextResponse.json({ error: "Failed to parse task" }, { status: 500 });
  }
}