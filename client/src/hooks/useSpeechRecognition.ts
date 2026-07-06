import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SpeechRecognition,
  SpeechRecognitionConstructor,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionResultEvent
} from "../types";

interface UseSpeechRecognitionOptions {
  language: string;
  onFinalResult: (text: string) => void;
  onDebug: (message: string, level?: "info" | "api" | "error") => void;
}

export function useSpeechRecognition({ language, onFinalResult, onDebug }: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const languageRef = useRef(language);
  const finalResultRef = useRef(onFinalResult);
  const debugRef = useRef(onDebug);
  const restartTimerRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Initializing speech recognition");

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    finalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    debugRef.current = onDebug;
  }, [onDebug]);

  useEffect(() => {
    const Recognition = (window.SpeechRecognition ?? window.webkitSpeechRecognition) as
      | SpeechRecognitionConstructor
      | undefined;

    if (!Recognition) {
      setIsSupported(false);
      setStatus("Speech recognition is not supported in this browser");
      setError("Use Chrome or Microsoft Edge for Web Speech API support.");
      debugRef.current("Browser speech recognition API is unavailable", "error");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageRef.current;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening");
      setError("");
      debugRef.current(`Speech recognition started (${languageRef.current})`);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const message = event.message || event.error;
      setError(message);
      debugRef.current(`Speech recognition error: ${message}`, "error");
    };

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript.trim() ?? "";

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          finalResultRef.current(transcript);
        } else {
          interim += `${transcript} `;
        }
      }

      setInterimTranscript(interim.trim());
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      debugRef.current("Speech recognition ended");

      if (!shouldListenRef.current) {
        setStatus("Paused");
        return;
      }

      restartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.lang = languageRef.current;
          recognition.start();
          debugRef.current("Speech recognition restarted");
        } catch (startError) {
          const message = startError instanceof Error ? startError.message : "Failed to restart recognition";
          setError(message);
          debugRef.current(message, "error");
        }
      }, 350);
    };

    recognitionRef.current = recognition;
    setStatus("Ready");

    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
      }
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    recognition.lang = language;
    debugRef.current(`Source language changed to ${language}`);

    if (shouldListenRef.current) {
      recognition.stop();
    }
  }, [language]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    shouldListenRef.current = true;
    try {
      recognition.lang = languageRef.current;
      recognition.start();
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Failed to start recognition";
      setError(message);
      debugRef.current(message, "error");
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    shouldListenRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
    }
    recognition?.stop();
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
