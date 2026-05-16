// app/api/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { CreateTaskInput } from "@/lib/types";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let query = "SELECT * FROM tasks";
    const params: string[] = [];
    if (status) { query += " WHERE status = ?"; params.push(status); }
    query += " ORDER BY due_date ASC, due_time ASC, priority DESC";
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ tasks: rows });
  } catch (error) {
    console.error("GET /api/tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateTaskInput = await req.json();
    const { title, description, due_date, due_time, priority, status = "todo", label, user_email } = body;

    if (!title || !due_date || !user_email) {
      return NextResponse.json({ error: "title, due_date, and user_email are required" }, { status: 400 });
    }
    if (priority < 1 || priority > 10) {
      return NextResponse.json({ error: "priority must be 1-10" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO tasks (title, description, due_date, due_time, priority, status, label, user_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description ?? null, due_date, due_time ?? null, priority, status, label ?? null, user_email]
    );

    const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM tasks WHERE id = ?", [result.insertId]);
    return NextResponse.json({ task: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}