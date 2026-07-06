export interface TranslateRequestBody {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
}

export interface TranslateResponseBody {
  translatedText: string;
  provider: "llama.cpp";
  model: string;
  elapsedMs: number;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

const DEFAULT_MODEL = "HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive:Q4_K_P";

const languageNames: Record<string, string> = {
  "ko-KR": "Korean",
  "en-US": "English",
  "pl-PL": "Polish",
  "ja-JP": "Japanese",
  "zh-CN": "Simplified Chinese",
  "es-ES": "Spanish",
  "fr-FR": "French",
  "de-DE": "German",
  "vi-VN": "Vietnamese",
  ko: "Korean",
  en: "English",
  pl: "Polish",
  ja: "Japanese",
  zh: "Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  vi: "Vietnamese"
};

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function languageName(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return languageNames[normalized] ?? (normalized || fallback);
}

function cleanOutput(output: string, fallback: string): string {
  const cleaned = output
    .replace(/\s+/g, " ")
    .replace(/^(translation|answer|translated text|번역|english|japanese|korean|polish|chinese)\s*[:：]\s*/i, "")
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "");

  return cleaned || fallback;
}

function buildMessages(request: TranslateRequestBody) {
  const source = languageName(request.sourceLanguage, "the source language");
  const target = languageName(request.targetLanguage, request.targetLanguage);
  const context = String(request.context ?? "").trim();

  const system = [
    "You are a professional real-time speech translator.",
    `Translate from ${source} to natural ${target}.`,
    `Output only the translated ${target} text.`,
    "Do not include quotes, explanations, notes, labels, markdown, or alternative translations."
  ].join(" ");

  const user = context
    ? [
        "Previous transcript context is provided only to resolve pronouns and continuity.",
        "Translate only the current text.",
        "",
        `Previous context:\n${context}`,
        "",
        `Current text:\n${request.text}`
      ].join("\n")
    : request.text;

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

export async function translateWithLlamaCpp(request: TranslateRequestBody): Promise<TranslateResponseBody> {
  const startedAt = performance.now();
  const baseUrl = normalizeBaseUrl(process.env.LLAMA_BASE_URL ?? "http://127.0.0.1:8080/v1");
  const model = process.env.LLAMA_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = envNumber("LLAMA_REQUEST_TIMEOUT_MS", 600000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLAMA_API_KEY ?? "local"}`
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(request),
        temperature: envNumber("LLAMA_TEMPERATURE", 0.1),
        top_p: envNumber("LLAMA_TOP_P", 0.95),
        top_k: envNumber("LLAMA_TOP_K", 64),
        max_tokens: envNumber("LLAMA_MAX_TOKENS", 128),
        stream: false
      })
    });

    const payload = (await response.json().catch(() => ({}))) as OpenAIChatCompletionResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `llama.cpp server returned HTTP ${response.status}`);
    }

    const rawText = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text ?? "";
    return {
      translatedText: cleanOutput(rawText, request.text),
      provider: "llama.cpp",
      model,
      elapsedMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`llama.cpp request timed out after ${timeoutMs}ms`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not reach local translation runtime at ${baseUrl}. Start it with: npm run local-runtime`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
