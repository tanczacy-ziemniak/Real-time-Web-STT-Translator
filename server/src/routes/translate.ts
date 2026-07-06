import { Router, type Request, type Response } from "express";
import { translateWithLlamaCpp, type TranslateRequestBody } from "../services/llamaCppService.js";

export const translateRouter = Router();

translateRouter.post("/", async (req: Request, res: Response) => {
  const body = req.body as Partial<TranslateRequestBody>;
  const text = String(body.text ?? "").trim();
  const targetLanguage = String(body.targetLanguage ?? "").trim();

  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  if (!targetLanguage) {
    res.status(400).json({ error: "Missing targetLanguage" });
    return;
  }

  try {
    const result = await translateWithLlamaCpp({
      text,
      sourceLanguage: body.sourceLanguage,
      targetLanguage,
      context: body.context
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown translation error";
    res.status(502).json({
      error: "Translation failed",
      detail: message
    });
  }
});
