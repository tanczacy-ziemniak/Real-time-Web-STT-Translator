import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Pause, Play, Server, Square } from "lucide-react";
import { translateText } from "./api/translate";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { DebugConsole } from "./components/DebugConsole";
import { LanguageSelector } from "./components/LanguageSelector";
import { TranscriptLog } from "./components/TranscriptLog";
import { useLocalTranscription } from "./hooks/useLocalTranscription";
import type { DebugLogEntry, LanguageOption, TranscriptEntry } from "./types";

const languages: LanguageOption[] = [
  { code: "ko-KR", name: "Korean", englishName: "Korean" },
  { code: "en-US", name: "English (US)", englishName: "English" },
  { code: "pl-PL", name: "Polish", englishName: "Polish" },
  { code: "ja-JP", name: "Japanese", englishName: "Japanese" },
  { code: "zh-CN", name: "Chinese", englishName: "Chinese" },
  { code: "es-ES", name: "Spanish", englishName: "Spanish" },
  { code: "fr-FR", name: "French", englishName: "French" },
  { code: "de-DE", name: "German", englishName: "German" },
  { code: "vi-VN", name: "Vietnamese", englishName: "Vietnamese" }
];

function nowTime() {
  return new Date().toLocaleTimeString();
}

function createId() {
  return crypto.randomUUID();
}

function transcriptContext(entries: TranscriptEntry[]) {
  return entries
    .filter((entry) => entry.status === "done")
    .slice(0, 4)
    .reverse()
    .map((entry) => `${entry.originalText} => ${entry.translatedText}`)
    .join("\n");
}

export default function App() {
  const [sourceLanguage, setSourceLanguage] = useState("ko-KR");
  const [targetLanguage, setTargetLanguage] = useState("Polish");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [micError, setMicError] = useState("");
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const entriesRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const addDebugLog = useCallback((message: string, level: DebugLogEntry["level"] = "info") => {
    setLogs((current) => [
      {
        id: createId(),
        timestamp: nowTime(),
        level,
        message
      },
      ...current
    ]);
  }, []);

  const handleFinalResult = useCallback(
    (text: string) => {
      const id = createId();
      const timestamp = nowTime();

      setEntries((current) => [
        {
          id,
          timestamp,
          originalText: text,
          translatedText: "",
          targetLanguage,
          status: "pending"
        },
        ...current
      ]);

      addDebugLog(`Final transcript: "${text}"`);
      addDebugLog(`Requesting translation to ${targetLanguage}`, "api");

      void translateText({
        text,
        sourceLanguage,
        targetLanguage,
        context: transcriptContext(entriesRef.current)
      })
        .then((result) => {
          setEntries((current) =>
            current.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    translatedText: result.translatedText,
                    status: "done",
                    elapsedMs: result.elapsedMs
                  }
                : entry
            )
          );
          addDebugLog(`Translation complete (${result.model}, ${result.elapsedMs}ms)`, "api");
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Translation failed";
          setEntries((current) =>
            current.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    translatedText: message,
                    status: "error",
                    error: message
                  }
                : entry
            )
          );
          addDebugLog(message, "error");
        });
    },
    [addDebugLog, sourceLanguage, targetLanguage]
  );

  const speech = useLocalTranscription({
    stream: mediaStream,
    language: sourceLanguage,
    onFinalResult: handleFinalResult,
    onDebug: addDebugLog
  });

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setMediaStream(stream);
        addDebugLog("Microphone stream connected");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Microphone permission failed";
        setMicError(message);
        addDebugLog(`Microphone error: ${message}`, "error");
      });

    return () => {
      cancelled = true;
    };
  }, [addDebugLog]);

  useEffect(() => {
    if (mediaStream && speech.isSupported && !hasAutoStarted) {
      speech.start();
      setHasAutoStarted(true);
    }
  }, [hasAutoStarted, mediaStream, speech]);

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
    };
  }, [mediaStream]);

  const statusLabel = useMemo(() => {
    if (micError) {
      return micError;
    }

    if (!speech.isSupported) {
      return speech.error || "Speech recognition unavailable";
    }

    return speech.error || speech.status;
  }, [micError, speech.error, speech.isSupported, speech.status]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Real-time STT Translator</h1>
          <p>Local Whisper STT / llama.cpp Gemma translation</p>
        </div>

        <div className="server-chip">
          <Server size={16} />
          <span>local runtime</span>
        </div>
      </header>

      <section className="control-band">
        <LanguageSelector
          languages={languages}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onSourceLanguageChange={setSourceLanguage}
          onTargetLanguageChange={setTargetLanguage}
        />

        <div className="transport-controls">
          <button className="primary-button" type="button" onClick={speech.start} disabled={!speech.isSupported || speech.isListening}>
            <Play size={17} />
            <span>Start</span>
          </button>
          <button className="secondary-button" type="button" onClick={speech.stop} disabled={!speech.isListening}>
            <Square size={17} />
            <span>Stop</span>
          </button>
        </div>
      </section>

      <section className={speech.isListening ? "status-row active" : "status-row"}>
        <div className="status-left">
          {speech.isListening ? <Mic size={18} /> : <Pause size={18} />}
          <span>{statusLabel}</span>
        </div>
        <span>{sourceLanguage} to {targetLanguage}</span>
      </section>

      <AudioVisualizer stream={mediaStream} />

      <div className="workspace-grid">
        <TranscriptLog entries={entries} interimTranscript={speech.interimTranscript} />
        <DebugConsole logs={logs} onClear={() => setLogs([])} />
      </div>
    </main>
  );
}
