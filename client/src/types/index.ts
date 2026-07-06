export interface LanguageOption {
  code: string;
  name: string;
  englishName: string;
}

export interface TranscriptEntry {
  id: string;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  timestamp: string;
  status: "pending" | "done" | "error";
  error?: string;
  elapsedMs?: number;
}

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "api" | "error";
  message: string;
}

export interface TranslateRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
}

export interface TranslateResponse {
  translatedText: string;
  provider: string;
  model: string;
  elapsedMs: number;
}

export interface TranscribeResponse {
  text: string;
  language?: string;
  provider: string;
  elapsedMs: number;
}

export interface SpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
