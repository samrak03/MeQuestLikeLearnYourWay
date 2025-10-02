# gecko_service_expand.py
# ------------------------------------------------------------
# FastAPI service for GECKO problem generation
# Run:
#   TZ=Asia/Seoul uvicorn gecko_service:app --host 0.0.0.0 --port 8001 \
#       --access-log --log-level info --reload
# Env (examples):
#   MODEL_ID=/mnt/d/MeQuest/models/GECKO-7B
#   GECKO_BACKEND=mock | vllm | tgi | openai
#   BACKEND_URL=http://localhost:8001  # for vllm/tgi (example)
#   OPENAI_API_KEY=sk-...              # for openai
#   OPENAI_BASE_URL=http://localhost:1234/v1   # LM Studio/OpenAI-compatible
#   OPENAI_MODEL=gecko-7b
# ------------------------------------------------------------

from __future__ import annotations

import os
import re
import json
import logging
from typing import Optional, List, Dict, Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------- Logging (KST) ------------------------
class KSTFormatter(logging.Formatter):
    converter = None  # use default time; we format manually

    def formatTime(self, record, datefmt=None):
        from datetime import datetime, timezone, timedelta
        kst = timezone(timedelta(hours=9))
        return datetime.fromtimestamp(record.created, tz=kst).strftime("%Y-%m-%d %H:%M:%S")

logging.basicConfig(
    level=logging.INFO,
    format='[ %(asctime)s ] %(levelname)s %(name)s - %(message)s',
)
for h in logging.getLogger().handlers:
    if isinstance(h.formatter, logging.Formatter):
        h.setFormatter(KSTFormatter('[ %(asctime)s ] %(levelname)s %(name)s - %(message)s'))

log = logging.getLogger("gecko")

# ---------------------- Config -------------------------------
MODEL_ID = os.environ.get("MODEL_ID", "/mnt/d/MeQuest/models/GECKO-7B")
BACKEND_KIND = (os.environ.get("GECKO_BACKEND", "mock") or "mock").lower()
BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "").rstrip("/")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

HTTP_TIMEOUT = float(os.environ.get("HTTP_TIMEOUT", "60"))
DEFAULT_STOP = json.loads(os.environ.get("STOP_TOKENS", '["```"]'))

# ---------------------- FastAPI ------------------------------
app = FastAPI(title="MeQuest GECKO Service", version="1.0")

# ---------------------- Schemas ------------------------------
class GenerateRequest(BaseModel):
    # accept any of these
    topic: Optional[str] = None
    input: Optional[str] = None
    prompt: Optional[str] = None

    # generation params (common subset)
    max_new_tokens: int = Field(default=256, ge=1, le=2048)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    repetition_penalty: float = Field(default=1.1, ge=0.8, le=2.0)

    # behavior
    strict_json: bool = True            # force single-line JSON output
    style: str = Field(default="qa", description="qa | mcq")  # output schema type
    stop: Optional[List[str]] = None    # override default stop tokens

class GenerateResponse(BaseModel):
    model_id: str
    prompt: str
    generated_text: str
    parsed_json: Optional[Dict[str, Any]] = None

# ---------------------- Prompting ----------------------------
def build_prompt(user_text: str, style: str = "qa", strict_json: bool = True) -> str:
    """
    style='qa'  -> {"question":"...","answer":"..."}
    style='mcq' -> {"question":"...","options":["A) ...", "B) ...", "C) ...", "D) ..."],"answer":"A"}
    """
    if style not in {"qa", "mcq"}:
        style = "qa"

    if style == "qa":
        schema_hint = '{"question":"...","answer":"..."}'
    else:
        schema_hint = '{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A"}'

    if strict_json:
        return (
            "You are an AI problem generator for MeQuest.\n"
            "Create exactly ONE problem and its correct answer based ONLY on the given topic.\n"
            "Do NOT include any markdown, code fences, or explanations.\n"
            f"Respond STRICTLY as a single-line JSON object matching this schema: {schema_hint}\n"
            f"Topic: {user_text}\n"
            f"Output: {schema_hint}"
        )
    # relaxed
    return f"Generate a single problem and answer for topic: {user_text}. Return JSON: {schema_hint}"

# ---------------------- Parsing utils ------------------------
_CODEFENCE = re.compile(r"```(?:json)?|```", re.IGNORECASE)

def extract_json_block(text: str) -> Optional[Dict[str, Any]]:
    """Remove code fences, find the first {...} and parse."""
    if not text:
        return None
    cleaned = _CODEFENCE.sub("", text).strip()
    # try direct
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    # find first {...}
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        return None
    candidate = m.group(0)
    # compact whitespace
    candidate = re.sub(r"\s+", " ", candidate).strip()
    # try parse as-is
    try:
        return json.loads(candidate)
    except Exception:
        # tiny fix: single quotes to double (very limited)
        try:
            return json.loads(candidate.replace("'", '"'))
        except Exception:
            return None

# ---------------------- Backends -----------------------------
def _infer_mock(prompt: str, req: GenerateRequest) -> str:
    """Deterministic mock output for wiring tests."""
    if req.style == "mcq":
        return json.dumps({
            "question": "직각삼각형에서 빗변의 길이를 구하시오. 밑변 6cm, 높이 8cm.",
            "options": ["A) 9cm", "B) 10cm", "C) 12cm", "D) 14cm"],
            "answer": "B"
        }, ensure_ascii=False)
    return json.dumps({
        "question": "직각삼각형에서 밑변이 6cm, 높이가 8cm일 때 빗변의 길이는?",
        "answer": "10cm"
    }, ensure_ascii=False)

def _infer_vllm(prompt: str, req: GenerateRequest) -> str:
    """
    vLLM-style /generate example (adjust to your server schema).
    Expected BACKEND_URL like http://localhost:8005
    """
    if not BACKEND_URL:
        raise RuntimeError("BACKEND_URL is not set for vllm backend")
    payload = {
        "prompt": prompt,
        "temperature": req.temperature,
        "max_tokens": req.max_new_tokens,
        "top_p": req.top_p,
        "repetition_penalty": req.repetition_penalty,
        "stop": req.stop or DEFAULT_STOP,
    }
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        r = client.post(f"{BACKEND_URL}/generate", json=payload)
        r.raise_for_status()
        data = r.json()
        # common patterns: {"text": "..."} or {"generated_text":"..."} or {"output":"..."}
        return str(data.get("text") or data.get("generated_text") or data.get("output") or data)

def _infer_tgi(prompt: str, req: GenerateRequest) -> str:
    """
    Hugging Face Text Generation Inference (TGI) /generate
    BACKEND_URL like http://localhost:8080
    """
    if not BACKEND_URL:
        raise RuntimeError("BACKEND_URL is not set for tgi backend")
    payload = {
        "inputs": prompt,
        "parameters": {
            "temperature": req.temperature,
            "max_new_tokens": req.max_new_tokens,
            "top_p": req.top_p,
            "repetition_penalty": req.repetition_penalty,
            "stop": req.stop or DEFAULT_STOP,
            "return_full_text": False,
        },
    }
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        r = client.post(f"{BACKEND_URL}/generate", json=payload)
        r.raise_for_status()
        data = r.json()
        # TGI usually returns list[ { "generated_text": "..." } ]
        if isinstance(data, list) and data:
            return str(data[0].get("generated_text") or "")
        return str(data.get("generated_text") or data)

def _infer_openai(prompt: str, req: GenerateRequest) -> str:
    """
    OpenAI-compatible /v1/chat/completions (LM Studio, Ollama proxy, etc.)
    """
    base = OPENAI_BASE_URL or "https://api.openai.com/v1"
    model = OPENAI_MODEL
    headers = {"Content-Type": "application/json"}
    if OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are an AI problem generator for MeQuest."},
            {"role": "user", "content": prompt},
        ],
        "temperature": req.temperature,
        "top_p": req.top_p,
        "n": 1,
        "max_tokens": req.max_new_tokens,
        "stop": req.stop or DEFAULT_STOP,
    }
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        r = client.post(f"{base}/chat/completions", headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        try:
            return data["choices"][0]["message"]["content"]
        except Exception:
            return str(data)

def model_generate(prompt: str, req: GenerateRequest) -> str:
    if BACKEND_KIND == "vllm":
        return _infer_vllm(prompt, req)
    if BACKEND_KIND == "tgi":
        return _infer_tgi(prompt, req)
    if BACKEND_KIND == "openai":
        return _infer_openai(prompt, req)
    # default mock
    return _infer_mock(prompt, req)

# ---------------------- Routes -------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "gecko",
        "model_id": MODEL_ID,
        "backend": BACKEND_KIND,
    }

@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    # 1) unify input
    text = req.topic or req.input or req.prompt
    if not text or not str(text).strip():
        raise HTTPException(status_code=422, detail="Field required: topic | input | prompt")

    # 2) build prompt
    prompt = build_prompt(text, style=req.style, strict_json=req.strict_json)

    # 3) inference
    try:
        out_text = model_generate(prompt, req)
    except httpx.HTTPError as e:
        log.exception("Backend HTTP error")
        raise HTTPException(status_code=502, detail=f"Backend error: {e}") from e
    except Exception as e:
        log.exception("Generation error")
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}") from e

    # 4) parse
    parsed = extract_json_block(out_text)

    return GenerateResponse(
        model_id=MODEL_ID,
        prompt=prompt,
        generated_text=out_text,
        parsed_json=parsed,
    )
