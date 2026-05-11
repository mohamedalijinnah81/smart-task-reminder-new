// app/api/parse-task/route.ts
// Converts natural language input (typed or transcribed voice) into a structured task JSON

import { NextRequest, NextResponse } from "next/server";

const today = () => new Date().toISOString().split("T")[0];

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const systemPrompt = `You are a task extraction assistant. The user will give you a natural language description of a task — either typed or transcribed from voice. Your job is to extract the task details and return a valid JSON object.

Today's date is ${today()}.

Extract:
- "title": Short, clear task title (required). Max 100 chars.
- "description": Optional longer description or context. Can be null.
- "due_date": Due date in YYYY-MM-DD format (required). If the user says "tomorrow", compute it. If they say "next Friday", compute it relative to today. If no date is mentioned, default to 7 days from today.
- "priority": Integer 1-10 (required). Default 5. Map hints like "urgent", "critical", "ASAP" → 9-10. "important", "high priority" → 7-8. "when you can", "low priority" → 2-3.
- "label": Optional short category label like "Work", "Personal", "Finance", "Health", "Calls", "Follow-up", etc. Infer from context. Can be null.

Return ONLY valid JSON, no markdown, no explanation:
{ "title": "...", "description": null, "due_date": "YYYY-MM-DD", "priority": 5, "label": null }`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      throw new Error(data.error?.message || "OpenAI request failed");
    }

    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    // Validate required fields
    if (!parsed.title || !parsed.due_date) {
      throw new Error("AI response missing required fields");
    }

    // Clamp priority
    parsed.priority = Math.min(10, Math.max(1, parseInt(parsed.priority) || 5));

    return NextResponse.json({ task: parsed });
  } catch (error) {
    console.error("parse-task error:", error);
    return NextResponse.json(
      { error: "Failed to parse task from input" },
      { status: 500 }
    );
  }
}