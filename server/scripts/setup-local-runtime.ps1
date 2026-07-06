param(
    [string]$PythonCommand = "python",
    [ValidateSet("cu124", "cu125", "cu130", "cu132", "vulkan", "cpu", "skip")]
    [string]$LlamaWheel = "cu124",
    [string]$LlamaCppPythonVersion = "0.3.32",
    [string]$LlamaWheelBaseUrl = "https://abetlen.github.io/llama-cpp-python/whl"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ServerDir ".venv"
$Python = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $ServerDir "python\requirements.txt"
$NvidiaRuntimePackages = @(
    "nvidia-cublas-cu12",
    "nvidia-cuda-nvrtc-cu12",
    "nvidia-cuda-runtime-cu12",
    "nvidia-cudnn-cu12",
    "nvidia-cufft-cu12",
    "nvidia-curand-cu12",
    "nvidia-cusolver-cu12",
    "nvidia-cusparse-cu12",
    "nvidia-nvjitlink-cu12"
)

function Invoke-Pip {
    param([Parameter(Mandatory=$true)][string[]]$Arguments)
    & $Python -m pip @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "pip command failed: $($Arguments -join ' ')"
    }
}

if (-not (Test-Path $Python)) {
    Write-Host "Creating Python virtual environment: $VenvDir"
    & $PythonCommand -m venv $VenvDir
}

if (-not (Test-Path $Python)) {
    throw "Python virtual environment was not created: $Python"
}

Invoke-Pip -Arguments @("install", "--upgrade", "pip", "setuptools", "wheel")
Invoke-Pip -Arguments @("install", "-r", $Requirements)

if ($LlamaWheel -ne "skip") {
    $IndexUrl = "$LlamaWheelBaseUrl/$LlamaWheel"
    if ($LlamaWheel.StartsWith("cu")) {
        Write-Host "Installing NVIDIA CUDA runtime Python packages..."
        $CudaRuntimeArgs = @("install", "--upgrade") + $NvidiaRuntimePackages
        Invoke-Pip -Arguments $CudaRuntimeArgs
    }

    Write-Host "Installing llama-cpp-python wheel..."
    Write-Host "  index: $IndexUrl"
    Invoke-Pip -Arguments @(
        "install",
        "--upgrade",
        "--force-reinstall",
        "--prefer-binary",
        "--extra-index-url",
        $IndexUrl,
        "llama-cpp-python==$LlamaCppPythonVersion"
    )
}

Write-Host "Local runtime dependencies are ready."
