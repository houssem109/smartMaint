/**
 * Ollama multimodal model for `/api/chat` with `messages[].images` (base64, no data-URL prefix).
 * Default **`llava:latest`** matches `ollama pull llava`. Override with **`OLLAMA_VISION_MODEL`** (e.g. `llava:13b`, `llama3.2-vision`).
 */
export function getOllamaVisionModel(): string {
  return process.env.OLLAMA_VISION_MODEL?.trim() || 'llava:latest';
}
