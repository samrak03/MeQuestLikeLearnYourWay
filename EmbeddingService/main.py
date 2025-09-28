# MeQuest/EmbeddingService/main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import os
import asyncpg # asyncpg 임포트
import logging # 로깅 임포트
from dotenv import load_dotenv

# pgvector 어댑터 임포트
from pgvector.asyncpg import register_vector # <-- pgvector 임포트 추가

# .env 파일 로드
load_dotenv()

# 로거 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 애플리케이션 인스턴스 생성
app = FastAPI(
    title="MeQuest Embedding Service",
    description="Service for generating embeddings and performing RAG search with PostgreSQL",
    version="0.1.0",
)


# 모델 및 서비스 설정
model = None
pg_pool = None
DEVICE = os.getenv("SERVICE_DEVICE", "cpu") # GPU 오류 방지용 기본값 'cpu'
MODEL_PATH = os.getenv("MODEL_PATH", None) # 모델 경로가 없으면 서비스 시작을 막기 위해 None

# PostgreSQL DB 설정
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = os.getenv("PG_PORT", 5432) # 포트 번호는 정수형으로 사용되므로, 연결 시점에 형 변환이 필요할 수 있음
PG_USER = os.getenv("PG_USER", "mequest_user")
PG_PASS = os.getenv("PG_PASS", "") # 비밀번호는 기본값 없이 공백으로 설정하여 설정 누락 시 오류 유도
PG_DB = os.getenv("PG_DB", "mequest_rag_db")


# 요청 본문 모델 정의 (임베딩 생성)
class EmbeddingRequest(BaseModel):
    texts: list[str]

# 요청 본문 모델 정의 (벡터 검색)
class VectorSearch(BaseModel):
    query_vector: list[float] # Node.js에서 미리 임베딩된 벡터
    limit: int = 5

@app.on_event("startup")
async def load_model():
    global model, pg_pool
    if not MODEL_PATH:
        logger.error("MODEL_PATH is not set in .env. Cannot start service.")
        raise HTTPException(status_code=500, detail="Model path configuration error.")

    try:
        # 1. 모델 로드
        logger.info(f"Loading BGE-m3 model from {MODEL_PATH} on device: {DEVICE}...")
        model = SentenceTransformer(MODEL_PATH, device=DEVICE)
        logger.info("BGE-m3 model loaded successfully.")

        # 2. asyncpg 연결 풀 생성
        logger.info("Creating asyncpg connection pool...")
        pg_pool = await asyncpg.create_pool(
            user=PG_USER,
            password=PG_PASS,
            database=PG_DB,
            host=PG_HOST,
            port=int(PG_PORT), # <-- 형 변환: 포트 번호를 정수형으로 변환
            timeout=5,
            min_size=1,
            max_size=10
        )
        logger.info("PostgreSQL connection pool created successfully.")
        
        # 3. pgvector 어댑터 등록
        async with pg_pool.acquire() as conn:
            await register_vector(conn)
        logger.info("pgvector asyncpg adapter registered successfully.")

    except Exception as e:
        logger.error(f"Error during startup: {e}", exc_info=True)
        model = None
        # 상세한 오류 메시지를 사용자에게 보여주기 위해 HTTPException 발생
        raise HTTPException(status_code=500, detail=f"Failed to start service. Check model path or DB credentials. Details: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    global pg_pool
    if pg_pool:
        await pg_pool.close() # 서버 종료 시 연결 풀 닫기
        logger.info("PostgreSQL connection pool closed.")

@app.get("/health", summary="Check the health of the embedding service")
async def health_check():
    model_status = model is not None
    db_status = False
    
    # asyncpg 연결 풀 상태 확인
    if pg_pool:
        try:
            # async with 구문을 사용하여 안전하게 연결을 획득하고 해제
            async with pg_pool.acquire() as conn:
                # 이 부분이 들여쓰기 되어야 합니다 (스페이스 4칸 또는 탭 1번)
                await conn.fetchval('SELECT 1') # 간단한 쿼리 실행
            db_status = True
        except Exception as e:
            logger.error(f"PostgreSQL Health Check Failed: {e}", exc_info=True)
            db_status = False

    return {
        "status": "ok",
        "model_loaded": model_status,
        "device": DEVICE,
        "db_connected": db_status
    }

@app.post("/embed", summary="Generate embeddings for a list of texts")
async def create_embedding(request: EmbeddingRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Embedding model not loaded.")
    
    try:
        # texts를 SentenceTransformer에 전달하여 임베딩 생성
        embeddings = model.encode(
                request.texts,
                convert_to_tensor=False,
                normalize_embeddings=True,  # RAG 검색 시 cosine similarity 대비 정규화 권장
                show_progress_bar=False
            ).tolist()
        
        return {"embeddings": embeddings}
    except Exception as e:
        logger.error(f"Error during embedding generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

@app.post("/search", summary="Search PostgreSQL embeddings using a vector")
async def search_embeddings(data: VectorSearch):
    if not pg_pool:
        raise HTTPException(status_code=503, detail="Database pool not initialized.")

    try:
        # 1. 쿼리 벡터를 pgvector가 인식하는 문자열 형태로 변환
        # 예: [0.1, -0.2, 0.3, ...]
        query_vector_str = f"[{', '.join(map(str, data.query_vector))}]"
        
        # 2. PostgreSQL 유사도 검색 쿼리 실행 (ORDER BY embedding <-> $1)
        # $1::vector 캐스팅을 사용하여 문자열을 벡터 타입으로 변환
        query = """
            SELECT content, ref_id, embedding <-> $1::vector AS distance
            FROM embeddings
            ORDER BY distance
            LIMIT $2;
        """
        
        # 3. asyncpg는 fetchall()을 사용하여 모든 결과를 비동기로 가져옵니다.
        # 매개변수는 튜플 형태로 전달
        results = await pg_pool.fetch(query, query_vector_str, data.limit)

        # 4. 결과 포맷팅: distance는 float로, ref_id는 int로 변환
        return [
            {
                "content": row["content"],
                "ref_id": row["ref_id"],
                "distance": float(row["distance"])
            }
            for row in results
        ]
        
    except Exception as e:
        logger.error(f"Error during RAG search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"RAG search failed: {e}")