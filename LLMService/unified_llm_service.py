# /mnt/d/MeQuest/LLMService/unified_llm_service.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import ollama
import json

# -----------------
# 1. 모델 설정
# -----------------
# Ollama에서 사용할 모델 이름
# 'qwen2.5:14b'를 기본값으로 사용
MODEL_ID = os.getenv("LLM_MODEL_ID", "qwen2.5:14b")

# -----------------
# 2. FastAPI 앱 설정
# -----------------
app = FastAPI(
    title=f"MeQuest Unified LLM Service (Ollama: {MODEL_ID})",
    version="3.0.0",
    description="Integrated service for Problem Generation, Summarization, and Feedback using Ollama"
)

# -----------------
# 3. 요청/응답 모델
# -----------------

class GenerateRequest(BaseModel):
    topic: str
    prompt: str | None = None # RAG 컨텍스트가 포함된 완성된 프롬프트일 수 있음
    model: str = MODEL_ID
    temperature: float = 0.7
    top_p: float = 0.9

class SummarizeRequest(BaseModel):
    document: str
    model: str = MODEL_ID

class FeedbackRequest(BaseModel):
    question: str
    user_answer: str
    correct_answer: str
    model: str = MODEL_ID

# -----------------
# 4. 헬퍼 함수
# -----------------
def generate_text(messages, model_id=MODEL_ID, temperature=0.7, format=None):
    try:
        options = {
            "temperature": temperature,
            "top_p": 0.9,
        }
        
        response = ollama.chat(
            model=model_id,
            messages=messages,
            options=options,
            format=format 
        )
        return response['message']['content']
    except Exception as e:
        print(f"❌ Ollama Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama generation failed: {str(e)}")

# -----------------
# 5. 엔드포인트
# -----------------

@app.get("/health")
async def health_check():
    try:
        # Ollama 서버 상태 확인
        ollama.list()
        return {"status": "ok", "backend": "ollama", "model": MODEL_ID}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# [기능 1] 문제 생성
@app.post("/generate")
async def generate_problem(req: GenerateRequest):
    if req.prompt:
         messages = [{"role": "user", "content": req.prompt}]
    else:
        messages = [
            {"role": "system", "content": "You are a helpful assistant that generates quiz problems in JSON format."},
            {"role": "user", "content": f"주제 '{req.topic}'에 대한 객관식 문제를 하나 만들어주세요. 출력은 오직 JSON 형식이어야 합니다. 키: question, options(배열), answer_index(0-3), explanation."}
        ]

    try:
        # JSON 포맷 강제 (Ollama 지원 시)
        result_text = generate_text(messages, req.model, req.temperature, format="json")
        
        # JSON 파싱
        try:
            parsed = json.loads(result_text)
        except:
            parsed = None
            
        return {
            "generated_text": result_text,
            "parsed_json": parsed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [기능 2] 요약
@app.post("/summarize")
async def summarize_document(req: SummarizeRequest):
    messages = [
        {"role": "system", "content": "You are an expert summarizer. Summarize the following text in Korean."},
        {"role": "user", "content": f"다음 텍스트를 요약해 주세요:\n\n{req.document}"}
    ]
    
    try:
        summary = generate_text(messages, req.model, temperature=0.5)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [기능 3] 피드백
@app.post("/feedback")
async def provide_feedback(req: FeedbackRequest):
    messages = [
        {"role": "system", "content": "You are an AI tutor. Explain why the user's answer is incorrect and provide the correct explanation in Korean."},
        {"role": "user", "content": f"문제: {req.question}\n사용자 답: {req.user_answer}\n정답: {req.correct_answer}\n\n사용자의 답이 왜 틀렸는지, 그리고 정답에 대한 해설을 친절하게 설명해 주세요."}
    ]
    
    try:
        feedback = generate_text(messages, req.model, temperature=0.7)
        return {"feedback": feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 기존 포트 8001 유지
    uvicorn.run(app, host="0.0.0.0", port=8001)
