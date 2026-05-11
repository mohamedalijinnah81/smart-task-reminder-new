// components/AITaskInput.tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Square, Check, X, Loader2, Sparkles } from "lucide-react";
import { AIParsedTask } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  onParsed: (task: AIParsedTask) => void;
}

type RecordingState = "idle" | "recording" | "processing_audio" | "processing_ai";

const BASE_HEIGHTS = [10, 18, 8, 20, 12, 16, 7, 21, 13, 9, 17, 11, 19, 8, 15, 22, 9, 14, 18, 10];
const BAR_COUNT = BASE_HEIGHTS.length;

export default function AITaskInput({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [barHeights, setBarHeights] = useState<number[]>(BASE_HEIGHTS.map(() => 3));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

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
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const bufferLength = dataArrayRef.current.length;
      const voiceRangeEnd = Math.floor(bufferLength * 0.3);

      const newHeights = Array.from({ length: BAR_COUNT }, (_, i) => {
        const bucketIndex = Math.floor((i / BAR_COUNT) * voiceRangeEnd);
        const freqValue = dataArrayRef.current![bucketIndex] / 255;
        return Math.max(3, freqValue * BASE_HEIGHTS[i] * 2.0);
      });

      setBarHeights(newHeights);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startAnalyser(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setRecordingState("recording");
    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopAnalyser();
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setRecordingState("idle");
    chunksRef.current = [];
  }, [recordingState]);

  const confirmRecording = useCallback(() => {
    if (!mediaRecorderRef.current || recordingState !== "recording") return;
    stopAnalyser();
    analyserRef.current = null;

    mediaRecorderRef.current.onstop = async () => {
      setRecordingState("processing_audio");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await res.json();
        if (data.text) {
          setText((prev) => (prev ? prev + " " + data.text : data.text));
        } else {
          setError("Transcription failed. Please try again.");
        }
      } catch {
        setError("Transcription failed. Please try again.");
      } finally {
        setRecordingState("idle");
        chunksRef.current = [];
      }
    };

    mediaRecorderRef.current.stop();
  }, [recordingState]);

  const handleParse = async () => {
    if (!text.trim()) return;
    setError("");
    setRecordingState("processing_ai");

    try {
      const res = await fetch("/api/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to parse");
      onParsed(data.task);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse task. Please try again.");
    } finally {
      setRecordingState("idle");
    }
  };

  const isProcessing = recordingState === "processing_audio" || recordingState === "processing_ai";

  return (
    <div className="w-full rounded-xl border bg-card p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Add task with AI</span>
        <span className="text-xs text-muted-foreground ml-1">
          Type or speak naturally — e.g. "Call Mr. Smith by Friday, priority 8"
        </span>
      </div>

      {/* Text input */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse();
        }}
        placeholder='e.g. "I need to follow up with the client about the invoice by next Tuesday, high priority, label Finance"'
        className="min-h-[80px] resize-none text-sm"
        disabled={isProcessing || recordingState === "recording"}
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Voice recording controls */}
        <div className="flex items-center gap-2">
          {recordingState === "idle" && (
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-border bg-background text-muted-foreground hover:bg-muted transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Record</span>
            </button>
          )}

          {recordingState === "recording" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background">
              {/* Cancel */}
              <button
                onClick={cancelRecording}
                className="flex items-center gap-1 text-xs font-medium text-red-700 hover:bg-red-50 px-1.5 py-1 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </button>

              <div className="w-px h-5 bg-border" />

              {/* Waveform */}
              <div className="flex items-end gap-[2px]" style={{ height: 24, minWidth: 64 }}>
                {barHeights.map((h, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      width: 3,
                      height: Math.max(3, h),
                      borderRadius: 999,
                      background: "hsl(var(--primary))",
                      transition: "height 0.08s ease-out",
                    }}
                  />
                ))}
              </div>

              <div className="w-px h-5 bg-border" />

              {/* Confirm */}
              <button
                onClick={confirmRecording}
                className="flex items-center gap-1 text-xs font-medium text-green-700 hover:bg-green-50 px-1.5 py-1 rounded-md transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Confirm</span>
              </button>
            </div>
          )}

          {recordingState === "processing_audio" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Transcribing…
            </div>
          )}
        </div>

        {/* Parse button */}
        <Button
          onClick={handleParse}
          disabled={!text.trim() || isProcessing || recordingState === "recording"}
          size="sm"
          className={cn("gap-1.5 shrink-0", recordingState === "processing_ai" && "opacity-80")}
        >
          {recordingState === "processing_ai" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Parsing…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Create Task
              <span className="hidden sm:inline text-xs opacity-70 ml-1">⌘↵</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}