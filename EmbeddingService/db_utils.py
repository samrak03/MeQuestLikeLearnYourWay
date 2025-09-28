# MeQuest/Backend/db_utils.py (예시 위치)

import os
import asyncpg
import asyncio
import aiohttp # get_embedding에서 사용
import json
from dotenv import load_dotenv # dotenv 임포트
from pgvector.asyncpg import register_vector # pgvector 어댑터 임포트

# --- .env 파일 로드 ---
# 이 유틸리티 파일이 호출될 때 환경 변수를 로드합니다.
# 이 파일이 FastAPI 앱에 의해 임포트된다면, main.py에서 이미 로드했으므로 중복입니다.
# 하지만 단독으로 실행될 테스트 스크립트라면 필요합니다.
load_dotenv()

# --- 환경 변수에서 DB 설정 로드 ---
DB_CONFIG = {
    "user": os.getenv("PG_USER", "mequest_user"),
    "password": os.getenv("PG_PASS", ""), # 비밀번호는 기본값 없이 공백으로 두어 설정 누락 시 오류 유도
    "database": os.getenv("PG_DB", "mequest_rag_db"),
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", 5432)) # 포트는 int로 변환
}

# --- FastAPI Embedding Service API URL 로드 ---
# 변수명과 기본값을 FastAPI 서비스에 맞게 수정했습니다.
EMBEDDING_SERVICE_URL = os.getenv("EMBEDDING_SERVICE_URL", "http://localhost:8000") # FastAPI 서버 URL

# --- 전역 변수 ---
# FastAPI 앱에서 공유될 DB 연결 풀
_db_pool = None 

# --- DB Pool 관리 함수 (FastAPI 앱의 startup/shutdown에서 사용될 예정) ---
async def init_db_pool():
    global _db_pool
    if _db_pool is None:
        try:
            _db_pool = await asyncpg.create_pool(**DB_CONFIG, timeout=5, min_size=1, max_size=10)
            async with _db_pool.acquire() as conn:
                await register_vector(conn) # pgvector 어댑터 등록
            print("PostgreSQL connection pool and pgvector adapter initialized.")
        except Exception as e:
            print(f"Failed to initialize PostgreSQL pool or register pgvector: {e}")
            raise # 초기화 실패 시 예외 발생

async def close_db_pool():
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None
        print("PostgreSQL connection pool closed.")

async def get_db_pool():
    if _db_pool is None:
        await init_db_pool() # 풀이 초기화되지 않았다면 초기화 시도
    return _db_pool

# --- 임베딩 생성 함수 ---
async def get_embedding(text_or_list: str | list[str]) -> list[list[float]]:
    """FastAPI Embedding Service 호출 → 임베딩 벡터 리스트 반환"""
    # FastAPI /embed 엔드포인트는 {"texts": ["text1", "text2"]} 형태를 기대합니다.
    texts_payload = [text_or_list] if isinstance(text_or_list, str) else text_or_list
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(f"{EMBEDDING_SERVICE_URL}/embed", json={"texts": texts_payload}) as resp:
                resp.raise_for_status() # 200번대 응답이 아니면 예외 발생
                data = await resp.json()
                if "embeddings" not in data or not isinstance(data["embeddings"], list):
                    raise ValueError("Invalid response from embedding service: missing 'embeddings' key or incorrect format.")
                return data["embeddings"]
        except aiohttp.ClientError as e:
            print(f"Error connecting to Embedding Service: {e}")
            raise
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON response from Embedding Service: {e}")
            raise

# --- 임베딩 삽입 함수 ---
async def insert_embedding(pool, content: str, vector: list[float], model_name="BGE-m3", source="test", ref_id=None):
    """PostgreSQL에 임베딩 삽입"""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO embeddings (model_name, source, ref_id, content, embedding)
            VALUES ($1, $2, $3, $4, $5)
            """,
            model_name, source, ref_id, content, vector
        )

# --- 임베딩 검색 함수 ---
async def search_embeddings(pool, query_vector: list[float], top_k=3) -> list[dict]:
    """임베딩 유사도 검색"""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, content, embedding <-> $1 AS distance
            FROM embeddings
            ORDER BY embedding <-> $1
            LIMIT $2;
            """,
            query_vector, top_k
        )
        # 결과는 Record 객체이므로 딕셔너리로 변환하여 반환
        return [dict(row) for row in rows]

# --- 테스트 실행 ---
async def main():
    # 이 테스트 스크립트에서는 init_db_pool을 직접 호출합니다.
    # 실제 FastAPI 앱에서는 startup 이벤트에서 호출됩니다.
    await init_db_pool() 
    pool = await get_db_pool()

    print("--- 1. 샘플 텍스트 임베딩 생성 ---")
    texts_to_embed = ["FastAPI와 PostgreSQL 연동 테스트 (asyncpg)", "이것은 두 번째 테스트 문장입니다."]
    vectors = await get_embedding(texts_to_embed)
    
    if vectors:
        print(f"Generated {len(vectors)} embeddings. First vector dim: {len(vectors[0])}")
        
        print("\n--- 2. 임베딩 삽입 ---")
        await insert_embedding(pool, texts_to_embed[0], vectors[0], source="FastAPI_test", ref_id=1)
        if len(vectors) > 1:
            await insert_embedding(pool, texts_to_embed[1], vectors[1], source="FastAPI_test", ref_id=2)
        print("Embeddings inserted successfully.")

        print("\n--- 3. 임베딩 검색 ---")
        query_text = "FastAPI 연동에 대한 질문"
        query_vector_list = await get_embedding(query_text) # get_embedding은 리스트를 반환하므로 첫 번째 항목 사용
        if query_vector_list:
            query_vector = query_vector_list[0]
            results = await search_embeddings(pool, query_vector, top_k=2)
            for i, row in enumerate(results):
                print(f"Result {i+1}: {row}")
        else:
            print("Failed to get query embedding.")

    await close_db_pool() # 테스트 완료 후 풀 닫기

if __name__ == "__main__":
    # 이 파일을 단독으로 실행할 때만 main() 함수가 호출됩니다.
    asyncio.run(main())