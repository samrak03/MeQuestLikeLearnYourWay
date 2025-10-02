from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch

# -----------------
# 1. 모델 설정
# Instruct 버전 사용을 강력히 권장합니다. (지시 수행 능력 향상)
# 만약 로컬 경로를 사용한다면: MODEL_ID = "/mnt/d/mequest/models/SOLAR-10.7B-Instruct-v1.0"

MODEL_ID = "/mnt/d/mequest/models/SOLAR-10.7B-Instruct-v1.0"

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
app = FastAPI(title="MeQuest SOLAR-10.7B Summarizer", version="1.0.1")

try:
    print(f"Loading {MODEL_ID} ...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        low_cpu_mem_usage=True
    )
    print("✅ SOLAR-10.7B Model Loaded Successfully")
except Exception as e:
    print(f"❌ Failed to load SOLAR model: {e}")
    # 모델 로드 실패 시 서버를 강제 종료하여 무거운 모델이 메모리만 차지하지 않도록 합니다.
    raise RuntimeError(f"Model Load Failed: {e}")

# -----------------
# 3. Pydantic 요청/응답 모델 정의
# -----------------
class GenerateRequest(BaseModel):
    """
    Node.js 백엔드와의 일관성을 위해 'text' 필드로 통일합니다.
    """
    document: str                     # 요약할 문서/텍스트
    max_new_tokens: int = 512
    temperature: float = 0.5
    repetition_penalty: float = 1.2

# 응답은 단순 텍스트 반환
class GenerateResponse(BaseModel):
    model_id: str
    summary: str
    
# -----------------
# 4. API 엔드포인트
# -----------------

@app.get("/health")
async def health():
    """모델 및 서버 상태 확인"""
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/summarize", response_model=GenerateResponse)
async def summarize(request: GenerateRequest):
    """
    문서를 받아 SOLAR-10.7B를 사용하여 요약합니다.
    """
    try:
        # SOLAR-10.7B의 역할: 요약 및 시각화 준비
        system_prompt = (
            "너는 한국어 교육 플랫폼을 위한 전문 요약입니다."
            "모든 응답은 **반드시 한국어(Korean)로만** 작성해야 하며, 다른 언어나 불필요한 마커([SOLUTION], [RESULT] 등)는 절대 포함하지 마세요. "
            "문서를 핵심만 요약하세요."
        )

        # 💡 SOLAR Instruct 모델의 대화 템플릿 (Mistral 포맷 사용)
        prompt_template = f"<s>[INST] {system_prompt}\n\nDocument: {request.document} [/INST]"
        
        # 1. 토큰화
        inputs = tokenizer(prompt_template, return_tensors="pt")
        inputs.pop("token_type_ids", None)   # 불필요한 key 제거
        inputs = inputs.to(model.device)
        
        # 2. 텍스트 생성
        outputs = model.generate(
            **inputs,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
            do_sample=False,
            # repetition_penalty=1.2,
            repetition_penalty=request.repetition_penalty,
            pad_token_id=tokenizer.eos_token_id
        )

        # 3. 결과 디코딩 및 후처리 (프롬프트 제거)
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        
        # 💡 생성된 텍스트에서 모델의 답변만 추출 (입력 프롬프트 템플릿 제거)
        # generated_text는 보통 "<s>[INST]...[/INST] 답변" 형태로 나오므로, [/INST] 이후를 추출합니다.
        
        if '[/INST]' in generated_text:
            summary = generated_text.split('[/INST]', 1)[-1].strip()
        else:
            summary = generated_text.strip() # 템플릿이 없을 경우 전체 반환
        

        # 💡 GPU 메모리 정리 (VRAM 안정성 향상)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


        return GenerateResponse(model_id=MODEL_ID, summary=summary)

    except Exception as e:
        print(f"❌ Summarization failed: {e}")
        # 추론 중 OOM 오류 등 발생 시 500 에러 반환
        raise HTTPException(status_code=500, detail=f"Summarization failed: {e}")

if __name__ == "__main__":
    import uvicorn
    # 💡 포트 8002 사용
    uvicorn.run(app, host="0.0.0.0", port=8002)
