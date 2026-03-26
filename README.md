# Real-time Web STT Translator (Powered by Ollama)

A simple, single-page web application that converts real-time speech to text using the browser's Web Speech API, and automatically translates it using a local Ollama instance running the `gemma3n:e2b` model.

This project includes a real-time audio visualizer and an integrated Debug Console to monitor STT status and API responses.

## 🌟 Key Features

* **Always-on Listening:** Continuously listens to microphone input (defaulting to Korean, customizable).
* **Local LLM Translation:** No API keys needed. Uses your local Ollama server for privacy and free usage.
* **Dynamic Language Selection:** Supports 9 built-in languages (Korean, English, Polish, Japanese, Chinese, Spanish, French, German, Vietnamese) via a user-friendly UI dropdown.
* **Integrated Debug Console:** Real-time logging of STT events, API request payloads, responses, and network errors.
* **Live Audio Visualizer:** Simple canvas visualizer showing microphone activity.
* **Reverse Chronological Log:** Displays latest original text and translation at the top.

## 📋 Prerequisites

Before running the application, ensure you have:

1.  A modern web browser with **Web Speech API support** (Google Chrome or Microsoft Edge recommended).
2.  **Ollama** installed and running on your local machine.
3.  The **`gemma3n:e2b`** model pulled in Ollama:
    ```bash
    ollama pull gemma3n:e2b
    ```

## 🚀 Step-by-Step Setup

This application strictly requires two setup steps regarding security and protocols to function.

### Step 1: Run Ollama with CORS Enabled

To allow the web browser to communicate with your local Ollama API, you must enable **CORS (Cross-Origin Resource Sharing)**.

**You must completely exit any existing Ollama background instances before doing this.**

* **Windows (Command Prompt):**
    ```cmd
    set OLLAMA_ORIGINS="*"
    ollama serve
    ```
* **macOS / Linux (Terminal):**
    ```bash
    OLLAMA_ORIGINS="*" ollama serve
    ```

### Step 2: Serve the Application via Local Server

Browser security policies often block microphone data transfer (required by STT) when running HTML files directly via `file://` protocol. You **must** serve this file using a local HTTP server.

* **Using VS Code:** Install the **Live Server** extension, right-click `index.html`, and select **Open with Live Server**.
* **Using Python:** Navigate to the project folder and run:
    ```bash
    python -m http.server 8000
    ```
    Then open `http://localhost:8000` in your browser.
