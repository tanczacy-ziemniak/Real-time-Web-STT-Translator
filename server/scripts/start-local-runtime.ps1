param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Split-Path -Parent $ScriptDir
$RepoDir = Split-Path -Parent $ServerDir
$Python = Join-Path $ServerDir ".venv\Scripts\python.exe"
$RuntimeDir = Join-Path $ServerDir "python"
$ModelDir = Join-Path $RepoDir ".models"

if (-not (Test-Path $Python)) {
    throw "Missing local runtime venv. Run: npm run setup:local-runtime"
}

$env:PYTHONUTF8 = "1"
if (-not $env:LOCAL_RUNTIME_MODEL_DIR) { $env:LOCAL_RUNTIME_MODEL_DIR = $ModelDir }
if (-not $env:STT_MODEL) { $env:STT_MODEL = "base" }
if (-not $env:STT_DEVICE) { $env:STT_DEVICE = "cpu" }
if (-not $env:STT_COMPUTE_TYPE) { $env:STT_COMPUTE_TYPE = "default" }
if (-not $env:LLAMA_MODEL_REPO) { $env:LLAMA_MODEL_REPO = "HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive" }
if (-not $env:LLAMA_MODEL_FILE) { $env:LLAMA_MODEL_FILE = "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf" }
if (-not $env:LLAMA_N_CTX) { $env:LLAMA_N_CTX = "2048" }
if (-not $env:LLAMA_N_GPU_LAYERS) { $env:LLAMA_N_GPU_LAYERS = "-1" }
if (-not $env:LLAMA_MAIN_GPU) { $env:LLAMA_MAIN_GPU = "0" }

Push-Location $RuntimeDir
try {
    & $Python -m uvicorn local_runtime:app --host $HostName --port $Port
} finally {
    Pop-Location
}
