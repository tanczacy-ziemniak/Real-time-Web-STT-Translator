import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../api/transcribe";

interface UseLocalTranscriptionOptions {
  stream: MediaStream | null;
  language: string;
  onFinalResult: (text: string) => void;
  onDebug: (message: string, level?: "info" | "api" | "error") => void;
  chunkMs?: number;
}

function preferredMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

export function useLocalTranscription({
  stream,
  language,
  onFinalResult,
  onDebug,
  chunkMs = 4200
}: UseLocalTranscriptionOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const segmentPartsRef = useRef<Blob[]>([]);
  const shouldListenRef = useRef(false);
  const inFlightRef = useRef(false);
  const queueRef = useRef<Blob[]>([]);
  const languageRef = useRef(language);
  const finalResultRef = useRef(onFinalResult);
  const debugRef = useRef(onDebug);

  const [isSupported] = useState(() => typeof MediaRecorder !== "undefined");
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    finalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    debugRef.current = onDebug;
  }, [onDebug]);

  const processQueue = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    const audio = queueRef.current.shift();
    if (!audio) {
      setInterimTranscript("");
      setStatus(shouldListenRef.current ? "Recording locally" : "Paused");
      return;
    }

    inFlightRef.current = true;
    setInterimTranscript("Transcribing local audio...");
    setStatus("Transcribing locally");

    try {
      const result = await transcribeAudio(audio, languageRef.current);
      if (result.text) {
        finalResultRef.current(result.text);
        debugRef.current(`Local STT complete (${result.elapsedMs}ms)`, "api");
      } else {
        debugRef.current("Local STT returned no speech");
      }
    } catch (transcribeError) {
      const message = transcribeError instanceof Error ? transcribeError.message : "Local transcription failed";
      setError(message);
      debugRef.current(message, "error");
    } finally {
      inFlightRef.current = false;
      void processQueue();
    }
  }, []);

  const stopCurrentSegment = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    try {
      recorder.stop();
    } catch (stopError) {
      const message = stopError instanceof Error ? stopError.message : "Failed to stop local recorder segment";
      setError(message);
      debugRef.current(message, "error");
    }
  }, []);

  const startSegment = useCallback(() => {
    if (!isSupported) {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    if (!stream || !shouldListenRef.current) {
      return;
    }

    if (!stream.active) {
      setError("Microphone stream is no longer active.");
      shouldListenRef.current = false;
      setIsListening(false);
      return;
    }

    if (recorderRef.current?.state === "recording") {
      return;
    }

    segmentPartsRef.current = [];
    const mimeType = preferredMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        segmentPartsRef.current.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      const message = event instanceof ErrorEvent ? event.message : "MediaRecorder error";
      setError(message);
      debugRef.current(message, "error");
    };

    recorder.onstop = () => {
      const parts = segmentPartsRef.current;
      const blob = new Blob(parts, {
        type: recorder.mimeType || mimeType || "application/octet-stream"
      });

      recorderRef.current = null;
      segmentPartsRef.current = [];

      if (blob.size >= 1024) {
        queueRef.current.push(blob);
        void processQueue();
      } else if (shouldListenRef.current) {
        debugRef.current("Skipped an empty local STT segment");
      }

      if (shouldListenRef.current) {
        window.setTimeout(startSegment, 30);
        return;
      }

      setIsListening(false);
      setStatus(queueRef.current.length || inFlightRef.current ? "Finishing local transcription" : "Paused");
      debugRef.current("Local STT recorder stopped");
    };

    recorder.start();
    setStatus("Recording locally");
    setInterimTranscript("Recording local audio...");
    segmentTimerRef.current = window.setTimeout(stopCurrentSegment, chunkMs);
  }, [chunkMs, isSupported, processQueue, stopCurrentSegment, stream]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    if (!stream) {
      setError("Microphone stream is not ready yet.");
      return;
    }

    if (recorderRef.current?.state === "recording") {
      return;
    }

    shouldListenRef.current = true;
    queueRef.current = [];
    setError("");
    setIsListening(true);
    setStatus("Recording locally");
    debugRef.current("Local STT recorder started");
    startSegment();
  }, [isSupported, startSegment, stream]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (segmentTimerRef.current !== null) {
      window.clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsListening(false);
      setStatus("Paused");
      return;
    }

    try {
      recorder.stop();
    } catch (stopError) {
      const message = stopError instanceof Error ? stopError.message : "Failed to stop local recorder";
      setError(message);
      debugRef.current(message, "error");
    }
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (segmentTimerRef.current !== null) {
        window.clearTimeout(segmentTimerRef.current);
      }
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    status,
    start,
    stop
  };
}
