// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) return NextResponse.json({ error: "No audio file" }, { status: 400 });

    const fd = new FormData();
    fd.append("file", audioFile, "recording.webm");
    fd.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: fd,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Transcription failed");
    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json({ error: "Failed to transcribe" }, { status: 500 });
  }
}