# Real-time Web STT Translator

React/Vite client and Express server for fully local speech-to-text and local GGUF translation.

The browser only records microphone audio. STT is handled by a local Python runtime with `faster-whisper`, and translation is handled by the same local runtime through `llama-cpp-python`.

## Structure

```text
client/                  # React / Vite / TypeScript
  src/
    components/
    hooks/
    api/
    types/
    App.tsx

server/                  # Node.js / Express / TypeScript
  src/
    routes/
    services/
    index.ts
  python/                # Local STT + translation runtime
    local_runtime.py
    requirements.txt
  scripts/
    setup-local-runtime.ps1
    start-local-runtime.ps1
```

The original `index_ollama.html` is still kept as a reference for the previous Ollama-based prototype.

## Runtime Flow

```text
Browser MediaRecorder
  -> Express /api/transcribe
  -> Local runtime /stt
  -> faster-whisper
  -> Express /api/translate
  -> Local runtime /v1/chat/completions
  -> llama-cpp-python + Gemma GGUF
```

No browser Web Speech API is used in the new React app.

## Setup

Install Node dependencies:

```powershell
npm install
```

Create the Python local runtime environment:

```powershell
npm run setup:local-runtime
```

For CUDA-enabled `llama-cpp-python` wheel installation, use:

```powershell
npm run setup:local-runtime:cuda
```

Start the local STT + translation runtime:

```powershell
npm run local-runtime
```

In another terminal, start the React + Express app:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Model Defaults

Local STT:

```text
STT_MODEL=base
STT_DEVICE=cpu
STT_COMPUTE_TYPE=default
```

Translation defaults are adapted from Boku No Translator:

```text
LLAMA_MODEL_REPO=HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive
LLAMA_MODEL_FILE=Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf
LLAMA_N_CTX=2048
LLAMA_N_GPU_LAYERS=-1
LLAMA_MAIN_GPU=0
```

The Gemma 4 GGUF model is several GB. First translation may require a large Hugging Face download.

## Useful Commands

```powershell
npm run typecheck
npm run build
npm run local-runtime
npm run dev --workspace server
npm run dev --workspace client
```

## Environment

Express server variables:

```text
PORT=3001
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
LLAMA_BASE_URL=http://127.0.0.1:8080/v1
LLAMA_MODEL=HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive:Q4_K_P
LLAMA_API_KEY=local
LLAMA_REQUEST_TIMEOUT_MS=600000
STT_BASE_URL=http://127.0.0.1:8080
STT_REQUEST_TIMEOUT_MS=120000
STT_MAX_AUDIO_MB=25
```

Local runtime variables:

```text
LOCAL_RUNTIME_MODEL_DIR=.models
STT_MODEL=base
STT_DEVICE=cpu
STT_COMPUTE_TYPE=default
LLAMA_MODEL_PATH=
LLAMA_MODEL_REPO=HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive
LLAMA_MODEL_FILE=Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf
LLAMA_N_CTX=2048
LLAMA_N_GPU_LAYERS=-1
LLAMA_MAIN_GPU=0
LLAMA_TEMPERATURE=0.1
LLAMA_TOP_P=0.95
LLAMA_TOP_K=64
LLAMA_MAX_TOKENS=128
```
