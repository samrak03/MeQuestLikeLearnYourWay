from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch
import os
import json 
import gc

# -----------------
# 1. 모델 설정
# -----------------
# EXAONE 공식 Instruct 모델 경로 (로컬 다운로드 위치)
# .env에 EXAONE_MODEL_PATH 환경 변수를 설정할 수 있습니다.
MODEL_ID = os.getenv("EXAONE_MODEL_PATH", "/mnt/d/mequest/models/EXAONE-3.5-7.8B-Instruct")

# 4bit 양자화 설정 (RTX 5070 환경 기준)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float16,
)

# -----------------
# 2. FastAPI 및 모델 로드
# -----------------
app = FastAPI(title="MeQuest EXAONE Feedback Generator", version="1.0.0")

try:
    print(f"Loading {MODEL_ID} (EXAONE-7.8B Instruct) ...")
    # tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_ID,
        trust_remote_code=True
    )

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    print("✅ EXAONE-7.8B Model Loaded Successfully on GPU!")
except Exception as e:
    print(f"❌ Failed to load EXAONE model: {e}")
    # 모델 로드 실패는 치명적이므로 서버 시작을 중단합니다.
    raise RuntimeError(f"Model Load Failed: {e}")

# -----------------
# 3. Pydantic 요청/응답 모델 정의
# -----------------
class GenerateRequest(BaseModel):
    """
    오답 피드백을 위해 문제, 사용자 답변, 정답을 받습니다.
    (Node.js llmService.js에서 이 필드명에 맞춰 요청을 전송해야 합니다.)
    """
    question: str                 # 원래 문제
    user_answer: str              # 사용자 답변
    correct_answer: str           # 정답
    max_new_tokens: int = 512
    temperature: float = 0.5
    repetition_penalty: float = 1.2
    
class GenerateResponse(BaseModel):
    """ 응답 포맷을 GECKO/SOLAR와 통일합니다. """
    model_id: str
    output: str 

# -----------------
# 4. API 엔드포인트
# -----------------

@app.get("/health")
async def health():
    """ 서버 및 모델 로드 상태 확인 """
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/feedback", response_model=GenerateResponse)
async def generate_feedback(request: GenerateRequest):
    """
    사용자의 오답에 대해 EXAONE 7.8B를 사용하여 건설적인 피드백을 제공합니다.
    """
    try:
        # EXAONE 역할: 오답 피드백 (일관성을 위해 결정론적 샘플링)
        system_prompt = (
            "너는 MeQuest의 오답 피드백 전문가이다. "
            "사용자가 제출한 답변을 분석하고, 왜 정답이 올바른지 한국어로 3~5 문장으로 친절하고 상세하게 설명하라."
        )

        # EXAONE Instruct 모델의 프롬프트 포맷 (Mistral/Llama Instruct 포맷 사용 가정)
        prompt_template = f"""<s>[INST] {system_prompt}

질문: {request.question}
사용자 답변: {request.user_answer}
정답: {request.correct_answer} [/INST]"""
        
        # 1. 토큰화 및 GPU 이동
        inputs = tokenizer(prompt_template, return_tensors="pt")
        # token_type_ids 제거 로직은 EXAONE 모델에서 불필요하다고 가정하고 제거
        inputs = inputs.to(model.device)   
        
        # 2. 텍스트 생성 (결정론적 샘플링)
        outputs = model.generate(
            **inputs,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
            do_sample=(request.temperature > 0), # ← 조건부 샘플링
            repetition_penalty=request.repetition_penalty,
            pad_token_id=tokenizer.eos_token_id
        )

        # 3. 결과 디코딩 및 후처리
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        
        # 프롬프트 템플릿 제거
        if '[/INST]' in generated_text:
            feedback = generated_text.split('[/INST]', 1)[-1].strip()
        else:
            feedback = generated_text.strip()
            
        # VRAM 정리 (안정성 확보)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        return GenerateResponse(model_id=MODEL_ID, output=feedback)

    except Exception as e:
        print(f"❌ Feedback Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Feedback Generation failed: {e}")

if __name__ == "__main__":
    import uvicorn
    # 💡 8003 포트 사용
    uvicorn.run(app, host="0.0.0.0", port=8003) 

# VRAM 정리
import gc
gc.collect()
if torch.cuda.is_available():
    torch.cuda.empty_cache()

