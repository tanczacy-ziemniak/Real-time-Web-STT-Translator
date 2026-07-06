import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { transcribeRouter } from "./routes/transcribe.js";
import { translateRouter } from "./routes/translate.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    provider: "local-runtime",
    llamaBaseUrl: process.env.LLAMA_BASE_URL ?? "http://127.0.0.1:8080/v1",
    sttBaseUrl: process.env.STT_BASE_URL ?? "http://127.0.0.1:8080",
    model: process.env.LLAMA_MODEL ?? "HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive:Q4_K_P"
  });
});

app.use("/api/translate", translateRouter);
app.use(
  "/api/transcribe",
  express.raw({
    type: (req) => {
      const contentType = String(req.headers["content-type"] ?? "");
      return contentType.startsWith("audio/") || contentType.startsWith("application/octet-stream");
    },
    limit: `${Number(process.env.STT_MAX_AUDIO_MB ?? 25)}mb`
  }),
  transcribeRouter
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    detail: err.message
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Translator server listening on http://127.0.0.1:${port}`);
});
