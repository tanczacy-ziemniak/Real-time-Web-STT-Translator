import { Router, type Request, type Response } from "express";
import { transcribeWithLocalRuntime } from "../services/sttService.js";

export const transcribeRouter = Router();

transcribeRouter.post("/", async (req: Request, res: Response) => {
  const audioBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const sourceLanguage = String(req.query.language ?? "").trim();
  const contentType = String(req.headers["content-type"] ?? "application/octet-stream");

  if (audioBuffer.length === 0) {
    res.status(400).json({ error: "Missing audio body" });
    return;
  }

  try {
    const result = await transcribeWithLocalRuntime({
      audioBuffer,
      contentType,
      sourceLanguage
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transcription error";
    res.status(502).json({
      error: "Transcription failed",
      detail: message
    });
  }
});
