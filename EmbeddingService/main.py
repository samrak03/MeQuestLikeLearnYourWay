from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch
import psycopg2
import logging
import os

# 로거 설정
logger = logging.getLogger("uvicorn.error") # Uvicorn의 에러 로거 사용
logger.setLevel(logging.DEBUG) # DEBUG 레벨로 설정


app = FastAPI(
    title="MeQuest Embedding Service",
    description="Text embedding service using BGE-m3 model.",
    version="1.0.0",
)

device = "cuda" if torch.cuda.is_available() else "cpu"
model = None

# DB 연결 정보 (환경변수 기반)
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = os.getenv("PG_PORT", "5432")
PG_USER = os.getenv("PG_USER", "mequest_user")
PG_PASS = os.getenv("PG_PASS", "mequest_user")
PG_DB   = os.getenv("PG_DB", "mequest_rag_db")

@app.on_event("startup")
async def load_model():
    global model
    try:
        # print(f"Loading BGE-m3 model on device: {device}...")
        # model = SentenceTransformer("/mnt/d/MeQuest/Models/bge-m3", device=device)
        # print("BGE-m3 model loaded successfully.")
        logger.info(f"Loading BGE-m3 model on device: {device}...")
        model = SentenceTransformer("/mnt/d/MeQuest/Models/bge-m3", device=device)
        logger.info("BGE-m3 model loaded successfully.")
    except Exception as e:
        # print(f"Error loading model: {e}")
        logger.error("Error loading model", exc_info=True)
        model = None   # 서버는 뜨되 model_loaded=False 로 표시됨

class TextToEmbed(BaseModel):
    text: str | list[str]

@app.post("/embed", summary="Generate embeddings for text(s)")
async def create_embedding(data: TextToEmbed):
    if model is None:
        raise HTTPException(status_code=503, detail="Embedding model not loaded yet.")

    try:
        embeddings = model.encode(data.text, normalize_embeddings=True).tolist()
        return {"embeddings": embeddings, "model": "BAAI/bge-m3", "dim": 1024}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

@app.get("/health", summary="Check the health of the embedding service")
async def health_check():
    # 1. 모델 상태
    model_status = model is not None

    # 2. DB 상태
    db_status = False
    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASS,
            dbname=PG_DB,
            connect_timeout=2
        )
        conn.close()
        db_status = True
    except Exception as e:
        db_status = False

    return {
        "status": "ok",
        "model_loaded": model_status,
        "device": device,
        "db_connected": db_status
    }
