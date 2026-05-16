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
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!(rows as RowDataPacket[]).length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ task: rows[0] });
  } catch (error) {
    console.error("GET /api/tasks/[id]:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const allowed = ["title", "description", "due_date", "due_time", "priority", "status", "label", "user_email"];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    if (!updates.length) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    values.push(id);
    await pool.execute(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`, values as any);

    const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!(rows as RowDataPacket[]).length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ task: rows[0] });
  } catch (error) {
    console.error("PATCH /api/tasks/[id]:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
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
    console.error("DELETE /api/tasks/[id]:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}