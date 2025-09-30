from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

# 로컬 모델 경로
model_id = "/mnt/d/MeQuest/models/GECKO-7B"

# 토크나이저 로드
tokenizer = AutoTokenizer.from_pretrained(model_id)

# 최신 권장 방식: BitsAndBytesConfig로 4bit 양자화 설정
quant_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

# 모델 로드
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto",
    quantization_config=quant_config
)

# 테스트 프롬프트
prompt = "수학 시험에서 사용할 수 있는 이차방정식 문제를 하나 만들어줘. 문제는 한국어로 작성하고, 보기와 함께 정답도 제시해줘."

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
inputs.pop("token_type_ids", None)

outputs = model.generate(
    **inputs,
    max_new_tokens=200,
    do_sample=True,
    temperature=0.7,
    top_p=0.9,
    repetition_penalty=1.2
)

print(tokenizer.decode(outputs[0], skip_special_tokens=True))