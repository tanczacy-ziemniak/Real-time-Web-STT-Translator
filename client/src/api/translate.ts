import type { TranslateRequest, TranslateResponse } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");

export async function translateText(request: TranslateRequest): Promise<TranslateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof payload.detail === "string" ? payload.detail : "Translation request failed";
    throw new Error(detail);
  }

  return payload as TranslateResponse;
}
