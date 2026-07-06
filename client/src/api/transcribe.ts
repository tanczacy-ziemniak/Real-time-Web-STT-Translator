import type { TranscribeResponse } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");

export async function transcribeAudio(audio: Blob, sourceLanguage: string): Promise<TranscribeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/transcribe?language=${encodeURIComponent(sourceLanguage)}`, {
    method: "POST",
    headers: {
      "Content-Type": audio.type || "application/octet-stream"
    },
    body: audio
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof payload.detail === "string" ? payload.detail : "Transcription request failed";
    throw new Error(detail);
  }

  return payload as TranscribeResponse;
}
