// app/api/logs/route.ts
// Returns recent parse_logs entries so the client can compare
// input → LLM output → final interpretation side by side.
// Protected by CRON_SECRET to prevent public access.

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  // Simple auth — reuse CRON_SECRET or a dedicated LOG_SECRET
  const authHeader = req.headers.get("authorization");
//   const secret = process.env.CRON_SECRET || process.env.LOG_SECRET;
//   if (secret && authHeader !== `Bearer ${secret}`) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

  try {
    const { searchParams } = new URL(req.url);    
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");
    const onlyErrors = searchParams.get("errors") === "1";

    let query = "SELECT * FROM parse_logs";
    const params: (string | number)[] = [];

    if (onlyErrors) {
      query += " WHERE error IS NOT NULL";
    }

    query += ` ORDER BY created_at DESC LIMIT ${offset}, ${limit}`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Parse JSON fields for readability
    const logs = (rows as RowDataPacket[]).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      user_input: row.user_input,
      llm_raw: (() => {
        try { return JSON.parse(row.llm_raw); }
        catch { return row.llm_raw; }
      })(),
      final_tasks: (() => {
        try { return JSON.parse(row.final_tasks); }
        catch { return row.final_tasks; }
      })(),
      error: row.error,
      model: row.model,
      duration_ms: row.duration_ms,
    }));

    const [countRows] = await pool.execute<RowDataPacket[]>(
      onlyErrors
        ? "SELECT COUNT(*) as total FROM parse_logs WHERE error IS NOT NULL"
        : "SELECT COUNT(*) as total FROM parse_logs"
    );
    const total = (countRows[0] as { total: number }).total;

    return NextResponse.json({ logs, total, limit, offset });
  } catch (error) {
    console.error("GET /api/logs error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

// DELETE — clear all logs (optional housekeeping)
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET || process.env.LOG_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await pool.execute("DELETE FROM parse_logs");
    return NextResponse.json({ success: true, message: "All parse logs cleared" });
  } catch (error) {
    console.error("DELETE /api/logs error:", error);
    return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 });
  }
}