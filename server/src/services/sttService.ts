interface TranscribeRequest {
  audioBuffer: Buffer;
  contentType: string;
  sourceLanguage?: string;
}

export interface TranscribeResponse {
  text: string;
  language?: string;
  provider: "local-whisper";
  elapsedMs: number;
}

interface LocalRuntimeTranscribeResponse {
  text?: string;
  language?: string;
  elapsed_ms?: number;
  error?: string;
  detail?: string;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function localRuntimeBaseUrl(): string {
  const sttBaseUrl = process.env.STT_BASE_URL;
  if (sttBaseUrl) {
    return sttBaseUrl.replace(/\/+$/, "");
  }

  const llamaBaseUrl = process.env.LLAMA_BASE_URL ?? "http://127.0.0.1:8080/v1";
  return llamaBaseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
}

function normalizeSttLanguage(sourceLanguage: string | undefined): string {
  const normalized = String(sourceLanguage ?? "").trim();
  const mapping: Record<string, string> = {
    "ko-KR": "ko",
    "en-US": "en",
    "pl-PL": "pl",
    "ja-JP": "ja",
    "zh-CN": "zh",
    "es-ES": "es",
    "fr-FR": "fr",
    "de-DE": "de",
    "vi-VN": "vi"
  };

  return mapping[normalized] ?? normalized;
}

function extensionForContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("wav")) {
    return "wav";
  }
  if (normalized.includes("mp4") || normalized.includes("mpeg")) {
    return "mp4";
  }
  if (normalized.includes("ogg")) {
    return "ogg";
  }
  return "webm";
}

export async function transcribeWithLocalRuntime(request: TranscribeRequest): Promise<TranscribeResponse> {
  const startedAt = performance.now();
  const baseUrl = localRuntimeBaseUrl();
  const timeoutMs = envNumber("STT_REQUEST_TIMEOUT_MS", 120000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const language = normalizeSttLanguage(request.sourceLanguage);
  const form = new FormData();
  const audio = new Blob([new Uint8Array(request.audioBuffer)], {
    type: request.contentType || "application/octet-stream"
  });

  form.append("audio", audio, `speech.${extensionForContentType(request.contentType)}`);
  if (language) {
    form.append("language", language);
  }

  try {
    const response = await fetch(`${baseUrl}/stt`, {
      method: "POST",
      signal: controller.signal,
      body: form
    });

    const payload = (await response.json().catch(() => ({}))) as LocalRuntimeTranscribeResponse;

    if (!response.ok) {
      throw new Error(payload.detail ?? payload.error ?? `local STT runtime returned HTTP ${response.status}`);
    }

    return {
      text: String(payload.text ?? "").trim(),
      language: payload.language,
      provider: "local-whisper",
      elapsedMs: Math.round(payload.elapsed_ms ?? performance.now() - startedAt)
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`local STT request timed out after ${timeoutMs}ms`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not reach local STT runtime at ${baseUrl}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
