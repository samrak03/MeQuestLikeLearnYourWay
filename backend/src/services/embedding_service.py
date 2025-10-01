from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="MeQuest Embedding Service")

class EmbeddingRequest(BaseModel):
    input: str

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dim: int
    model: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "embedding", "port": 8000}

@app.post("/embeddings", response_model=EmbeddingResponse)
def create_embedding(req: EmbeddingRequest):
    text = req.input or ""
    # 데모 임베딩(임시): 길이 기반 3차원 벡터
    vec = [len(text) % 7 / 10, len(text) % 11 / 10, len(text) % 13 / 10]
    return {"embedding": vec, "dim": len(vec), "model": "mock-emb"}
