# MeQuest/EmbeddingService/main.py (이전 코드와 동일)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch
import os

app = FastAPI(
    title="MeQuest Embedding Service",
    description="Text embedding service using BGE-m3 model.",
    version="1.0.0",
)

device = "cuda" if torch.cuda.is_available() else "cpu"
model = None

@app.on_event("startup")
async def load_model():
    global model
    try:
        print(f"Loading BGE-m3 model on device: {device}...")
        model = SentenceTransformer('BAAI/bge-m3', device=device)
        print("BGE-m3 model loaded successfully.")
    except Exception as e:
        print(f"Error loading model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load embedding model: {e}")

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
        print(f"Error during embedding generation: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

@app.get("/health", summary="Check the health of the embedding service")
async def health_check():
    return {"status": "ok", "model_loaded": model is not None, "device": device}