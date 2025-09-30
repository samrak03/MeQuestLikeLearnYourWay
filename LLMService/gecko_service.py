# /mnt/d/MeQuest/LLMService/gecko_service.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import json
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

# -----------------
# 1. 모델 설정
# -----------------
# Hugging Face Hub 모델 ID 대신 로컬 절대 경로 권장
MODEL_ID = "/mnt/d/MeQuest/models/GECKO-7B"

# 4bit 양자화 설정 (RTX 5070 12GB 환경 기준)
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
    title="MeQuest GECKO-7B Problem Generator",
    version="1.0.1"
)

# 모델 및 토크나이저를 전역에 선언하여 서버 시작 시 한 번만 로드합니다.
try:
    print(f"Loading Model: {MODEL_ID} with 4-bit quantization...")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        low_cpu_mem_usage=True
    )
    print("✅ GECKO-7B Model Loaded Successfully on GPU!")

except Exception as e:
    print(f"❌ FATAL ERROR: Failed to load GECKO-7B model: {e}")
    raise RuntimeError(f"Model Load Failed: {e}")

# -----------------
# 3. Pydantic 요청/응답 모델 정의
# -----------------
class GenerateRequest(BaseModel):
    """Node.js 백엔드로부터 받을 요청 데이터 모델"""
    topic: str
    max_new_tokens: int = 256
    temperature: float = 0.8
    top_p: float = 0.9
    repetition_penalty: float = 1.2

class GenerateResponse(BaseModel):
    """응답 데이터 모델"""
    model_id: str
    prompt: str
    generated_text: str
    parsed_json: dict | None = None

# -----------------
# 4. API 엔드포인트
# -----------------

@app.get("/health")
async def health_check():
    """모델 및 서버 상태 확인"""
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/generate", response_model=GenerateResponse)
async def generate_problem(request: GenerateRequest):
    """
    주제를 받아 GECKO-7B를 사용하여 객관식 문제를 JSON 형식으로 생성합니다.
    """
    system_prompt = (
        "You are an AI problem generator for MeQuest. "
        "Create one multiple-choice question with 4 options and the correct answer based on the user's topic. "
        "Respond only with a single JSON object (strictly start with '{' and end with '}'): "
    )

    full_prompt = f"{system_prompt}\n\nTopic: {request.topic}\n\n"

    try:
        # 1. 토큰화
        inputs = tokenizer(full_prompt, return_tensors="pt")
        inputs = inputs.to(model.device)

        # 2. 텍스트 생성
        outputs = model.generate(
            **inputs,
            max_new_tokens=request.max_new_tokens,
            do_sample=True,
            temperature=request.temperature,
            top_p=request.top_p,
            repetition_penalty=request.repetition_penalty,
            pad_token_id=tokenizer.eos_token_id
        )

        # 3. 결과 디코딩
        generated_text = tokenizer.decode(
            outputs[0], skip_special_tokens=True
        ).replace(full_prompt, "").strip()

        # 4. JSON 파싱 시도
        parsed_json = None
        try:
            start_index = generated_text.find("{")
            end_index = generated_text.rfind("}")
            if start_index != -1 and end_index != -1:
                json_str = generated_text[start_index:end_index + 1]
                parsed_json = json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON Parsing Error: {e}")

        return GenerateResponse(
            model_id=MODEL_ID,
            prompt=full_prompt,
            generated_text=generated_text,
            parsed_json=parsed_json
        )

    except Exception as e:
        print(f"❌ Text Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"LLM Generation Failed: {e}")

# -----------------
# 5. 서버 실행
# -----------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
