"""PaddleOCR-VL via Hugging Face Transformers (GPU) — matches the online HF demo."""

from __future__ import annotations

import base64
import os
from io import BytesIO
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from PIL import Image

app = FastAPI(title="SmartMaint PaddleOCR-VL", version="2.2.0")

_model: Any = None
_processor: Any = None
_model_id = os.getenv("PADDLE_OCR_VL_MODEL", "PaddlePaddle/PaddleOCR-VL").strip()
_max_new_tokens = int(os.getenv("PADDLE_OCR_VL_MAX_TOKENS", "2048"))


def gpu_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def get_device() -> str:
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


def get_model_and_processor():
    """Load once on first OCR (official HF recipe; transformers 4.57.x + trust_remote_code)."""
    global _model, _processor
    if _model is not None and _processor is not None:
        return _model, _processor

    import torch
    from transformers import AutoModelForCausalLM, AutoProcessor

    device = get_device()
    dtype = torch.bfloat16 if device == "cuda" else torch.float32

    processor = AutoProcessor.from_pretrained(_model_id, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        _model_id,
        trust_remote_code=True,
        torch_dtype=dtype,
    ).to(device).eval()

    _processor = processor
    _model = model
    return _model, _processor


def run_vl_on_bytes(image_bytes: bytes) -> tuple[str, float | None]:
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    try:
        import torch

        model, processor = get_model_and_processor()
        device = get_device()

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": "OCR:"},
                ],
            }
        ]

        inputs = processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt",
        ).to(device)

        with torch.inference_mode():
            outputs = model.generate(**inputs, max_new_tokens=_max_new_tokens)

        decoded = processor.batch_decode(outputs, skip_special_tokens=True)
        text = ""
        if decoded:
            raw = str(decoded[0])
            # Keep only assistant reply after the OCR prompt when present.
            if "OCR:" in raw:
                text = raw.split("OCR:")[-1].strip()
            else:
                text = raw.strip()

        return text, (0.88 if text else None)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PaddleOCR-VL inference failed: {exc}") from exc


class OcrJsonBody(BaseModel):
    imageBase64: str = Field(..., min_length=8)


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "SmartMaint PaddleOCR-VL (Hugging Face)",
        "status": "running",
        "engine": "paddleocr-vl",
        "model": _model_id,
        "gpu": gpu_available(),
        "endpoints": {
            "GET /health": "Liveness (model loads on first OCR)",
            "GET /gpu-check": "GPU status",
            "POST /ocr/json": "OCR { imageBase64 }",
        },
    }


@app.get("/gpu-check")
def gpu_check() -> dict[str, Any]:
    info: dict[str, Any] = {"engine": "paddleocr-vl", "model": _model_id, "gpu_available": False}
    try:
        import torch

        info["gpu_available"] = torch.cuda.is_available()
        if info["gpu_available"]:
            info["gpu_name"] = torch.cuda.get_device_name(0)
            info["vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2)
    except Exception as exc:
        info["error"] = str(exc)
    info["model_loaded"] = _model is not None
    return info


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "engine": "paddleocr-vl",
        "model": _model_id,
        "gpu": gpu_available(),
        "model_loaded": _model is not None,
    }


@app.post("/ocr")
async def ocr_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    text, confidence = run_vl_on_bytes(data)
    return {"text": text, "confidence": confidence, "engine": "paddleocr-vl", "gpu": gpu_available()}


@app.post("/ocr/json")
async def ocr_json(body: OcrJsonBody) -> dict[str, Any]:
    raw = body.imageBase64.strip()
    if raw.startswith("data:"):
        comma = raw.find(",")
        if comma >= 0:
            raw = raw[comma + 1 :]
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {exc}") from exc
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    text, confidence = run_vl_on_bytes(data)
    return {"text": text, "confidence": confidence, "engine": "paddleocr-vl", "gpu": gpu_available()}
