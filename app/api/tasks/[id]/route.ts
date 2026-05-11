// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM tasks WHERE id = ?",
      [id]
    );
    if ((rows as RowDataPacket[]).length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task: rows[0] });
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowedFields = ["title", "description", "due_date", "priority", "status", "label", "user_email"];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    values.push(id);
    await pool.execute(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`,
      values as any
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM tasks WHERE id = ?",
      [id]
    );

    if ((rows as RowDataPacket[]).length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: rows[0] });
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pool.execute("DELETE FROM tasks WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}