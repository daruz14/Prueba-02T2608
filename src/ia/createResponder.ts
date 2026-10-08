import type { Config } from "../config.js";
import { fakeResponder } from "./fake.js";
import { createGeminiResponder } from "./gemini.js";
import type { Responder } from "./types.js";

export function createResponder(config: Config): Responder {
  if (config.MODEL_BACKEND === "fake") {
    return fakeResponder;
  }
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when MODEL_BACKEND=gemini");
  }
  return createGeminiResponder({
    apiKey: config.GEMINI_API_KEY,
    model: config.GEMINI_MODEL,
  });
}
