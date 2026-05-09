// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT setting_key, setting_value FROM app_settings"
    );

    const settings: Record<string, string> = {};
    for (const row of rows as { setting_key: string; setting_value: string }[]) {
      settings[row.setting_key] = row.setting_value ?? "";
    }

    // Never expose smtp_pass to client
    delete settings["smtp_pass"];

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: Record<string, string> = await req.json();

    const allowedKeys = [
      "default_user_email",
      "smtp_host",
      "smtp_port",
      "smtp_user",
      "smtp_pass",
      "smtp_from_name",
      "reminder_days_before",
    ];

    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue;
      // Don't overwrite smtp_pass if blank (user left it empty)
      if (key === "smtp_pass" && value === "") continue;

      await pool.execute(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, value, value]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}