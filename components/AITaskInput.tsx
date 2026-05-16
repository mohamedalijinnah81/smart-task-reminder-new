// components/AITaskInput.tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { Mic, Check, X, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIParsedTask } from "@/lib/types";

interface QueueItem {
  id: string;
  text: string;
  status: "processing" | "done" | "error";
  taskCount?: number;
  error?: string;
}

interface Props {
  onCreated: () => void;
  defaultEmail: string;
}

type RecordState = "idle" | "recording" | "transcribing";

const BASE_HEIGHTS = [10, 18, 8, 20, 12, 16, 7, 21, 13, 9, 17, 11, 19, 8, 15, 22, 9, 14, 18, 10];
const BAR_COUNT = BASE_HEIGHTS.length;

export default function AITaskInput({ onCreated, defaultEmail }: Props) {
  const [text, setText] = useState("");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [barHeights, setBarHeights] = useState<number[]>(BASE_HEIGHTS.map(() => 3));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Queue management ──────────────────────────────────────────────
  const addToQueue = (text: string): string => {
    const id = Math.random().toString(36).slice(2);
    setQueue((q) => [...q.slice(-4), { id, text: text.slice(0, 50) + (text.length > 50 ? "…" : ""), status: "processing" }]);
    return id;
  };

  const updateQueue = (id: string, update: Partial<QueueItem>) => {
    setQueue((q) => q.map((item) => item.id === id ? { ...item, ...update } : item));
    // Auto-remove done/error items after 4 seconds
    setTimeout(() => setQueue((q) => q.filter((item) => item.id !== id)), 4000);
  };

  // ── Core: parse + create (non-blocking — runs in background) ─────
  const parseAndCreate = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const queueId = addToQueue(trimmed);

    try {
      // Parse with AI
      const parseRes = await fetch("/api/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData.tasks?.length) throw new Error(parseData.error || "Parse failed");

      const tasks: AIParsedTask[] = parseData.tasks;

      // Create all tasks in parallel
      await Promise.all(
        tasks.map((task) =>
          fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...task,
              user_email: defaultEmail,
              status: "todo",
            }),
          })
        )
      );

      updateQueue(queueId, { status: "done", taskCount: tasks.length });
      onCreated(); // refresh board
    } catch (err) {
      updateQueue(queueId, {
        status: "error",
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }, [defaultEmail, onCreated]);

  // ── Submit from text input ────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && text.trim()) {
      const val = text.trim();
      setText(""); // clear immediately — user can type next task right away
      parseAndCreate(val);
    }
  };

  // ── Voice recording ───────────────────────────────────────────────
  const stopAnalyser = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    setBarHeights(BASE_HEIGHTS.map(() => 3));
  };

  const startAnalyser = (stream: MediaStream) => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    dataArrayRef.current = dataArray;

    const tick = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const voiceEnd = Math.floor(dataArrayRef.current.length * 0.3);
      setBarHeights(Array.from({ length: BAR_COUNT }, (_, i) => {
        const idx = Math.floor((i / BAR_COUNT) * voiceEnd);
        return Math.max(3, (dataArrayRef.current![idx] / 255) * BASE_HEIGHTS[i] * 2);
      }));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startAnalyser(stream);
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      setRecordState("recording");
    } catch {
      // microphone denied — silently ignore
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopAnalyser();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setRecordState("idle");
    chunksRef.current = [];
  }, []);

  const confirmRecording = useCallback(() => {
    if (!mediaRecorderRef.current || recordState !== "recording") return;
    stopAnalyser();

    mediaRecorderRef.current.onstop = async () => {
      setRecordState("transcribing");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");

      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        setRecordState("idle");
        if (data.text) {
          // Show transcribed text briefly in input, then clear and process
          setText(data.text);
          setTimeout(() => {
            setText("");
            parseAndCreate(data.text);
          }, 400);
        }
      } catch {
        setRecordState("idle");
      }
    };

    mediaRecorderRef.current.stop();
  }, [recordState, parseAndCreate]);

  return (
    <div className="w-full space-y-2">
      {/* Main input bar */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg bg-white px-3 py-2 transition-all",
          recordState === "recording"
            ? "ring-2 ring-red-400"
            : "shadow hover:shadow-md focus-within:ring-2 focus-within:ring-blue-400"
        )}
      >
        <Sparkles className="w-4 h-4 shrink-0 text-blue-500" />

        {recordState === "recording" ? (
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-end gap-[2px]" style={{ height: 22 }}>
              {barHeights.map((h, i) => (
                <span key={i} style={{
                  display: "inline-block", width: 3,
                  height: Math.max(3, h), borderRadius: 999,
                  background: "#ef4444", transition: "height 0.08s ease-out",
                }} />
              ))}
            </div>
            <span className="text-sm text-red-500 font-medium">Recording…</span>
          </div>
        ) : recordState === "transcribing" ? (
          <div className="flex-1 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Transcribing…
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Type a task and press Enter — e.g. "Call Mr. Smith tomorrow at 3pm, urgent"'
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 min-w-0"
          />
        )}

        <div className="flex items-center gap-1 shrink-0">
          {recordState === "recording" && (
            <>
              <button onClick={cancelRecording} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Cancel">
                <X className="w-4 h-4" />
              </button>
              <button onClick={confirmRecording} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Done — create task">
                <Check className="w-4 h-4" />
              </button>
            </>
          )}
          {recordState === "idle" && (
            <button onClick={startRecording} className="p-1.5 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600" title="Record voice">
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hint line */}
      <p className="text-xs text-gray-400 px-1">
        Press <kbd className="bg-gray-100 border border-gray-200 rounded px-1 py-px text-gray-500 text-xs">Enter</kbd> to create instantly ·{" "}
        Multiple tasks: <span className="italic">"Call John and send invoice by Friday"</span>
      </p>

      {/* Processing queue — shows background tasks without blocking input */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-1">
          {queue.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                item.status === "processing" && "bg-blue-50 text-blue-700",
                item.status === "done" && "bg-green-50 text-green-700",
                item.status === "error" && "bg-red-50 text-red-600",
              )}
            >
              {item.status === "processing" && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
              {item.status === "done" && <CheckCircle className="w-3 h-3 shrink-0" />}
              {item.status === "error" && <X className="w-3 h-3 shrink-0" />}
              <span className="truncate">
                {item.status === "processing" && `Creating: "${item.text}"`}
                {item.status === "done" && `✓ Created${item.taskCount && item.taskCount > 1 ? ` ${item.taskCount} tasks` : ""}: "${item.text}"`}
                {item.status === "error" && `Failed: ${item.error}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}