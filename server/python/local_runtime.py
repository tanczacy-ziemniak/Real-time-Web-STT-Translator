import os
import sys
import tempfile
import threading
import time
import ctypes
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel


APP_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = Path(os.environ.get("LOCAL_RUNTIME_MODEL_DIR", APP_DIR / ".models")).resolve()
HF_HOME = MODEL_DIR / "huggingface"
os.environ.setdefault("HF_HOME", str(HF_HOME))
os.environ.setdefault("HF_HUB_CACHE", str(HF_HOME / "hub"))
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

MODEL_DIR.mkdir(parents=True, exist_ok=True)
HF_HOME.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Real-time STT Translator Local Runtime")

stt_model = None
stt_lock = threading.Lock()
stt_infer_lock = threading.Lock()
llama_model = None
llama_load_lock = threading.Lock()
llama_generate_lock = threading.Lock()
llama_runtime_device = "unloaded"
dll_directory_handles = []
preloaded_dll_handles = []


def add_dll_search_dir(path: Path):
    if sys.platform != "win32" or not path.is_dir():
        return

    normalized = str(path.resolve())
    if any(existing == normalized for existing, _handle in dll_directory_handles):
        return

    try:
        handle = os.add_dll_directory(normalized)
        dll_directory_handles.append((normalized, handle))
    except Exception:
        return

    current_path = os.environ.get("PATH", "")
    existing_paths = [part.lower() for part in current_path.split(os.pathsep) if part]
    if normalized.lower() not in existing_paths:
        os.environ["PATH"] = normalized + os.pathsep + current_path


def configure_llama_cpp_dlls():
    if sys.platform != "win32":
        return

    site_packages = Path(sys.prefix) / "Lib" / "site-packages"
    candidate_dirs = [
        site_packages / "llama_cpp" / "lib",
        site_packages / "bin",
    ]

    for rel in (
        "nvidia/cublas/bin",
        "nvidia/cuda_nvrtc/bin",
        "nvidia/cuda_runtime/bin",
        "nvidia/cudnn/bin",
        "nvidia/cufft/bin",
        "nvidia/curand/bin",
        "nvidia/cusolver/bin",
        "nvidia/cusparse/bin",
        "nvidia/nvjitlink/bin",
    ):
        candidate_dirs.append(site_packages / rel)

    for dll_dir in candidate_dirs:
        add_dll_search_dir(dll_dir)

    for dll_dir in candidate_dirs[:2]:
        if not dll_dir.is_dir():
            continue
        for dll_name in ("ggml-base.dll", "ggml-cpu.dll", "ggml-cuda.dll", "ggml.dll", "llama.dll", "mtmd.dll"):
            dll_path = dll_dir / dll_name
            normalized = str(dll_path.resolve()) if dll_path.exists() else ""
            if not normalized or any(existing == normalized for existing, _handle in preloaded_dll_handles):
                continue
            try:
                handle = ctypes.CDLL(normalized)
                preloaded_dll_handles.append((normalized, handle))
            except Exception:
                pass


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[dict[str, Any]]
    temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    max_tokens: int | None = None
    stream: bool | None = False


def env_int(name: str, fallback: int) -> int:
    try:
        return int(os.environ.get(name, fallback))
    except Exception:
        return fallback


def env_float(name: str, fallback: float) -> float:
    try:
        return float(os.environ.get(name, fallback))
    except Exception:
        return fallback


def get_stt_model():
    global stt_model

    if stt_model is not None:
        return stt_model

    with stt_lock:
        if stt_model is not None:
            return stt_model

        from faster_whisper import WhisperModel

        model_name = os.environ.get("STT_MODEL", "base")
        device = os.environ.get("STT_DEVICE", "cpu")
        compute_type = os.environ.get("STT_COMPUTE_TYPE", "default")
        cpu_threads = env_int("STT_CPU_THREADS", max(1, os.cpu_count() or 1))

        stt_model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            cpu_threads=cpu_threads,
            download_root=str(MODEL_DIR / "whisper"),
        )
        return stt_model


def resolve_llama_model_path() -> str:
    explicit_path = os.environ.get("LLAMA_MODEL_PATH", "").strip()
    if explicit_path:
        path = Path(explicit_path).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"LLAMA_MODEL_PATH does not exist: {path}")
        return str(path)

    repo_id = os.environ.get("LLAMA_MODEL_REPO", "HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive")
    filename = os.environ.get("LLAMA_MODEL_FILE", "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf")

    from huggingface_hub import hf_hub_download

    return hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        cache_dir=str(HF_HOME / "hub"),
    )


def load_llama_with_layers(model_path: str, n_gpu_layers: int):
    configure_llama_cpp_dlls()

    from llama_cpp import Llama

    return Llama(
        model_path=model_path,
        n_ctx=env_int("LLAMA_N_CTX", 2048),
        n_gpu_layers=n_gpu_layers,
        main_gpu=env_int("LLAMA_MAIN_GPU", 0),
        verbose=False,
    )


def get_llama_model():
    global llama_model, llama_runtime_device

    if llama_model is not None:
        return llama_model

    with llama_load_lock:
        if llama_model is not None:
            return llama_model

        model_path = resolve_llama_model_path()
        n_gpu_layers = env_int("LLAMA_N_GPU_LAYERS", -1)

        try:
            llama_model = load_llama_with_layers(model_path, n_gpu_layers)
            llama_runtime_device = "gpu" if n_gpu_layers != 0 else "cpu"
        except Exception:
            if n_gpu_layers == 0:
                raise
            llama_model = load_llama_with_layers(model_path, 0)
            llama_runtime_device = "cpu-fallback"

        return llama_model


def normalize_language(language: str) -> str | None:
    normalized = (language or "").strip()
    return normalized or None


def transcribe_file(path: str, language: str, started_at: float) -> dict[str, Any]:
    model = get_stt_model()

    with stt_infer_lock:
        segments, info = model.transcribe(
            path,
            language=normalize_language(language),
            vad_filter=True,
            beam_size=5,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()

    detected_language = getattr(info, "language", None)
    return {
        "text": text,
        "language": detected_language,
        "provider": "local-whisper",
        "elapsed_ms": round((time.perf_counter() - started_at) * 1000),
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "stt": {
            "provider": "faster-whisper",
            "model": os.environ.get("STT_MODEL", "base"),
            "loaded": stt_model is not None,
        },
        "translation": {
            "provider": "llama-cpp-python",
            "repo": os.environ.get("LLAMA_MODEL_REPO", "HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive"),
            "file": os.environ.get("LLAMA_MODEL_FILE", "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf"),
            "loaded": llama_model is not None,
            "device": llama_runtime_device,
        },
        "model_dir": str(MODEL_DIR),
    }


@app.post("/stt")
async def transcribe(audio: UploadFile = File(...), language: str = Form("")):
    started_at = time.perf_counter()
    suffix = Path(audio.filename or "speech.webm").suffix or ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
      return await run_in_threadpool(transcribe_file, tmp_path, language, started_at)
    except Exception as exc:
      raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
      try:
          Path(tmp_path).unlink(missing_ok=True)
      except Exception:
          pass


@app.post("/v1/chat/completions")
def chat_completions(request: ChatCompletionRequest):
    if request.stream:
        raise HTTPException(status_code=400, detail="Streaming is not supported by this local runtime endpoint.")

    llama = get_llama_model()

    with llama_generate_lock:
        try:
            response = llama.create_chat_completion(
                messages=request.messages,
                temperature=request.temperature if request.temperature is not None else env_float("LLAMA_TEMPERATURE", 0.1),
                top_p=request.top_p if request.top_p is not None else env_float("LLAMA_TOP_P", 0.95),
                top_k=request.top_k if request.top_k is not None else env_int("LLAMA_TOP_K", 64),
                max_tokens=request.max_tokens if request.max_tokens is not None else env_int("LLAMA_MAX_TOKENS", 128),
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JSONResponse(response)
