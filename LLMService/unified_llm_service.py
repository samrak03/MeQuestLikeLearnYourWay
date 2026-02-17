# /mnt/d/MeQuest/LLMService/unified_llm_service.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import torch
import json
import os
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

# -----------------
# 1. 모델 설정
# -----------------
# Qwen2.5-14B-Instruct-GPTQ-Int4 (또는 사용자가 다운로드한 경로)
# 환경 변수 또는 절대 경로 사용
MODEL_ID = os.getenv("LLM_MODEL_PATH", "/mnt/d/MeQuest/models/Qwen2.5-14B-Instruct-GPTQ-Int4")

# 4bit 양자화 설정 (BitsAndBytes - 만약 GPTQ 모델을 직접 로드한다면 AutoModelForCausalLM이 자동 처리할 수도 있음)
# 여기서는 일반적인 HF 모델 로드 + BNB 4bit 로드 방식을 가정 (Safetensors + BNB)
# 만약 GPTQ 전용 모델이라면 'quantization_config' 설정이 다를 수 있음.
# 범용성을 위해 BNB Config를 유지하되, Qwen은 'trust_remote_code=True'가 필요할 수 있음.

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float16
)

# -----------------
# 2. FastAPI 및 모델 로드
# -----------------
app = FastAPI(
    title="MeQuest Unified LLM Service (Qwen2.5-14B)",
    version="2.0.0",
    description="Integrated service for Problem Generation, Summarization, and Feedback"
)

# 모델/토크나이저 전역 변수
model = None
tokenizer = None

@app.on_event("startup")
async def load_model():
    global model, tokenizer
    try:
        print(f"Loading Unified Model: {MODEL_ID}...")

        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            quantization_config=bnb_config, # GPTQ 모델인 경우 device_map="auto" 만으로 충분할 수 있음
            device_map="auto",
            low_cpu_mem_usage=True,
            trust_remote_code=True
        )
        print("✅ Qwen2.5-14B Model Loaded Successfully!")
    except Exception as e:
        print(f"❌ FATAL ERROR: Failed to load model: {e}")
        # 서비스 시작 실패를 알리지만, 프로세스가 죽지 않도록 예외 처리
        # 실제 배포 시에는 raise e 로 종료하는 것이 나을 수 있음

# -----------------
# 3. 요청/응답 모델
# -----------------

class GenerateRequest(BaseModel):
    topic: str
    prompt: str | None = None # RAG 컨텍스트가 포함된 완성된 프롬프트일 수 있음
    max_new_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9

class SummarizeRequest(BaseModel):
    document: str
    max_new_tokens: int = 1024

class FeedbackRequest(BaseModel):
    question: str
    user_answer: str
    correct_answer: str

# -----------------
# 4. 헬퍼 함수
# -----------------
def generate_text(prompt, max_new_tokens=512, temperature=0.7):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    
    inputs = tokenizer([prompt], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=temperature,
            pad_token_id=tokenizer.eos_token_id
        )
    
    generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # 입력 프롬프트 제거 (Qwen 등 일부 모델은 입력 포함하여 반환하므로)
    if generated.startswith(prompt):
        generated = generated[len(prompt):]
        
    return generated.strip()

# -----------------
# 5. 엔드포인트
# -----------------

@app.get("/health")
async def health_check():
    return {"status": "ok", "model": MODEL_ID, "loaded": model is not None}

# [기능 1] 문제 생성 (구 Gecko 대체)
@app.post("/generate")
async def generate_problem(req: GenerateRequest):
    # 만약 Node.js에서 완성된 prompt를 보내지 않고 topic만 보냈다면 여기서 구성
    if req.prompt:
        final_prompt = req.prompt
    else:
        # Qwen Chat Template 사용 권장
        messages = [
            {"role": "system", "content": "You are a helpful assistant that generates quiz problems in JSON format."},
            {"role": "user", "content": f"주제 '{req.topic}'에 대한 객관식 문제를 하나 만들어주세요. 출력은 오직 JSON 형식이어야 합니다. 키: question, options(배열), answer_index(0-3), explanation."}
        ]
        # apply_chat_template 사용
        final_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    try:
        result_text = generate_text(final_prompt, req.max_new_tokens, req.temperature)
        
        # JSON 파싱 시도 (간단한 처리)
        parsed = None
        try:
            start = result_text.find("{")
            end = result_text.rfind("}")
            if start != -1 and end != -1:
                json_str = result_text[start:end+1]
                parsed = json.loads(json_str)
        except:
            pass
            
        return {
            "generated_text": result_text,
            "parsed_json": parsed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [기능 2] 요약 (구 Solar 대체)
@app.post("/summarize")
async def summarize_document(req: SummarizeRequest):
    messages = [
        {"role": "system", "content": "You are an expert summarizer. Summarize the following text in Korean."},
        {"role": "user", "content": f"다음 텍스트를 요약해 주세요:\n\n{req.document}"}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    try:
        summary = generate_text(prompt, req.max_new_tokens, temperature=0.5) # 요약은 낮은 온도 권장
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [기능 3] 피드백 (구 Exaone 대체)
@app.post("/feedback")
async def provide_feedback(req: FeedbackRequest):
    messages = [
        {"role": "system", "content": "You are an AI tutor. Explain why the user's answer is incorrect and provide the correct explanation in Korean."},
        {"role": "user", "content": f"문제: {req.question}\n사용자 답: {req.user_answer}\n정답: {req.correct_answer}\n\n사용자의 답이 왜 틀렸는지, 그리고 정답에 대한 해설을 친절하게 설명해 주세요."}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    try:
        feedback = generate_text(prompt, max_new_tokens=512, temperature=0.7)
        return {"feedback": feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 기존 포트 8001 (Gecko가 쓰던 포트) 사용, 필요시 조정
    uvicorn.run(app, host="0.0.0.0", port=8001)
