# PaddleOCR-VL via Hugging Face Transformers (same family as the online HF demo).
# Avoids the 1.9 GB paddlepaddle-gpu wheel from Baidu CDN that often corrupts on slow links.
FROM nvidia/cuda:12.6.0-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/models/huggingface
ENV TRANSFORMERS_CACHE=/models/huggingface
ENV PADDLE_OCR_VL_MODEL=PaddlePaddle/PaddleOCR-VL

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && pip install --no-cache-dir --upgrade pip

WORKDIR /app

# PyTorch CUDA 12.6 (~800 MB, stable PyTorch CDN)
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cu126

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

RUN mkdir -p /models/huggingface

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=15s --start-period=900s --retries=8 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
