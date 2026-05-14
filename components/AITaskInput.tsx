// components/AITaskInput.tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, Check, X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onCreated: () => void; // just refresh the board
  defaultEmail: string;
}

type State = "idle" | "recording" | "transcribing" | "parsing";

const BASE_HEIGHTS = [10, 18, 8, 20, 12, 16, 7, 21, 13, 9, 17, 11, 19, 8, 15, 22, 9, 14, 18, 10];
const BAR_COUNT = BASE_HEIGHTS.length;

export default function AITaskInput({ onCreated, defaultEmail }: Props) {
  const [text, setText] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [lastCreated, setLastCreated] = useState("");
  const [barHeights, setBarHeights] = useState<number[]>(BASE_HEIGHTS.map(() => 3));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      stopAnalyser();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  const stopAnalyser = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
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
      analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
      const voiceEnd = Math.floor(dataArrayRef.current.length * 0.3);
      setBarHeights(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          const idx = Math.floor((i / BAR_COUNT) * voiceEnd);
          const v = dataArrayRef.current![idx] / 255;
          return Math.max(3, v * BASE_HEIGHTS[i] * 2);
        })
      );
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const startRecording = useCallback(async () => {
    setError("");
    setLastCreated("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startAnalyser(stream);
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      setState("recording");
    } catch {
      setError("Microphone access denied.");
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopAnalyser();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    analyserRef.current = null;
    setState("idle");
    chunksRef.current = [];
  }, []);

  // Core: transcribe audio → parse → create task — all in one shot, no dialog
  const confirmRecording = useCallback(() => {
    if (!mediaRecorderRef.current || state !== "recording") return;
    stopAnalyser();
    analyserRef.current = null;

    mediaRecorderRef.current.onstop = async () => {
      setState("transcribing");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      chunksRef.current = [];

      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await res.json();
        if (!data.text) throw new Error("Transcription failed");
        await parseAndCreate(data.text);
      } catch {
        setError("Voice transcription failed. Please try again.");
        setState("idle");
      }
    };

    mediaRecorderRef.current.stop();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseAndCreate = async (input: string) => {
    setState("parsing");
    setError("");
    try {
      // Step 1: parse with AI
      const parseRes = await fetch("/api/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData.task) throw new Error(parseData.error || "Parse failed");

      // Step 2: immediately create the task — no dialog
      const createRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parseData.task,
          user_email: defaultEmail,
          status: "todo",
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create task");

      setLastCreated(`✓ Created: "${parseData.task.title}"`);
      setText("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setState("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && text.trim()) {
      parseAndCreate(text.trim());
    }
  };

  const isProcessing = state === "transcribing" || state === "parsing";

  return (
    <div className="w-full">
      {/* Single-line fast input — looks like Trello's "Add a card" */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border-2 bg-white px-3 py-2 transition-all",
          state === "recording" ? "border-red-400" : "border-transparent shadow focus-within:border-blue-400 focus-within:shadow-md"
        )}
        style={{ boxShadow: state !== "recording" ? "0 1px 3px rgba(0,0,0,0.12)" : undefined }}
      >
        <Sparkles className="w-4 h-4 shrink-0 text-blue-500" />

        {state === "recording" ? (
          /* Waveform replaces input during recording */
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-end gap-[2px]" style={{ height: 24, minWidth: 80 }}>
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
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); setLastCreated(""); }}
            onKeyDown={handleKeyDown}
            placeholder='Type a task and press Enter — e.g. "Call Mr. Smith tomorrow, urgent"'
            disabled={isProcessing}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 min-w-0"
          />
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {isProcessing && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium px-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {state === "transcribing" ? "Transcribing…" : "Creating…"}
            </div>
          )}

          {state === "recording" && (
            <>
              <button
                onClick={cancelRecording}
                className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={confirmRecording}
                className="p-1.5 rounded hover:bg-green-50 text-green-600 transition-colors"
                title="Confirm & create task"
              >
                <Check className="w-4 h-4" />
              </button>
            </>
          )}

          {state === "idle" && (
            <button
              onClick={startRecording}
              className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors"
              title="Record voice"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline feedback — no overlay */}
      {lastCreated && (
        <p className="text-xs text-green-600 font-medium mt-1.5 px-1">{lastCreated}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1.5 px-1">{error}</p>
      )}
      <p className="text-xs text-gray-400 mt-1 px-1">
        Press <kbd className="bg-gray-100 border border-gray-200 rounded px-1 text-gray-500">Enter</kbd> to create instantly ·{" "}
        <kbd className="bg-gray-100 border border-gray-200 rounded px-1 text-gray-500">🎙</kbd> for voice
      </p>
    </div>
  );
}