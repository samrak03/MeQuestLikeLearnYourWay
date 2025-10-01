#!/bin/bash

# Node.js LLM API 서버의 기본 URL (3000 포트)
BASE_URL="http://localhost:3000/api/llm"

# 헤더 설정
HEADERS="Content-Type: application/json"

echo "======================================================"
echo "    🚀 Node.js LLM API 통합 테스트 시작 (3000 포트)"
echo "    --------------------------------------------------"
echo "    (Node.js 서버가 3000, GECKO 8001, SOLAR 8002, EXAONE 8003 포트로 실행 중이어야 합니다.)"
echo "======================================================"


# ----------------------------------------------------------------
# 1. GECKO 테스트 (문제 생성)
# 역할: topic 필드 사용 (Node.js llmService에서 8001 포트 호출)
# ----------------------------------------------------------------
echo ""
echo "--- 1. GECKO (8001) 문제 생성 테스트: topic 필드 사용 ---"
TOPIC="인공지능 RAG 시스템의 작동 원리와 장점"

RESPONSE_GECKO=$(curl -s -X GET "$BASE_URL/gecko?topic=$(echo "$TOPIC" | tr ' ' '%20')" -H "$HEADERS")

echo "요청 주제: $TOPIC"
echo "응답 상태 및 결과:"
echo "$RESPONSE_GECKO" | jq .

# JSON 파싱 성공 여부 확인
if echo "$RESPONSE_GECKO" | jq -e '.result' > /dev/null; then
    echo "✅ GECKO 테스트 성공: JSON 문제 데이터 파싱 완료."
else
    echo "❌ GECKO 테스트 실패: Node.js에서 JSON 파싱 실패 또는 오류 발생."
fi


# ----------------------------------------------------------------
# 2. SOLAR 테스트 (문서 요약)
# 역할: document 필드 사용 (Node.js llmService에서 8002 포트 호출)
# ----------------------------------------------------------------
echo ""
echo "--- 2. SOLAR (8002) 문서 요약 테스트: document 필드 사용 ---"
DOCUMENT="Node.js는 싱글 스레드 이벤트 루프를 기반으로 하여 비동기 작업을 효율적으로 처리합니다. 하지만 LLM과 같은 무거운 GPU 작업은 파이썬과 FastAPI로 마이크로 서비스를 분리하는 것이 서버의 성능과 안정성 유지에 유리합니다."

RESPONSE_SOLAR=$(curl -s -X GET "$BASE_URL/solar?document=$(echo "$DOCUMENT" | tr ' ' '%20')" -H "$HEADERS")

echo "요청 문서 (일부): ${DOCUMENT:0:30}..."
echo "응답 상태 및 결과:"
echo "$RESPONSE_SOLAR" | jq .

# 요약 결과가 비어있지 않은지 확인
if echo "$RESPONSE_SOLAR" | jq -e '.output | select(length > 10)' > /dev/null; then
    echo "✅ SOLAR 테스트 성공: 한국어 요약 결과 수신 완료."
else
    echo "❌ SOLAR 테스트 실패: 요약 결과가 비어있거나 오류 발생."
fi


# ----------------------------------------------------------------
# 3. EXAONE 테스트 (오답 피드백)
# 역할: question, user_answer, correct_answer 필드 사용 (8003 포트 호출)
# ----------------------------------------------------------------
echo ""
echo "--- 3. EXAONE (8003) 오답 피드백 테스트: 여러 필드 사용 ---"
QUESTION="LLM 서비스 아키텍처에서 마이크로 서비스를 분리하는 가장 큰 이유는?"
USER_ANSWER="Node.js 개발자가 Python을 좋아하기 때문."
CORRECT_ANSWER="LLM 추론의 높은 GPU/CPU 부하를 Node.js 이벤트 루프에서 분리하여 서버 안정성을 확보하기 위함."

# EXAONE 호출은 GET 쿼리 대신 POST body를 사용하는 것이 더 안전하지만,
# 현재 Node.js 라우터가 GET으로 설정되어 있으므로 URL 인코딩을 통해 GET으로 요청합니다.

RESPONSE_EXAONE=$(curl -s -X GET "$BASE_URL/exaone?question=$(echo "$QUESTION" | tr ' ' '%20')&user_answer=$(echo "$USER_ANSWER" | tr ' ' '%20')&correct_answer=$(echo "$CORRECT_ANSWER" | tr ' ' '%20')" -H "$HEADERS")

echo "응답 상태 및 결과:"
echo "$RESPONSE_EXAONE" | jq .

# 피드백 결과가 비어있지 않은지 확인
if echo "$RESPONSE_EXAONE" | jq -e '.output | select(length > 10)' > /dev/null; then
    echo "✅ EXAONE 테스트 성공: 피드백 텍스트 수신 완료."
else
    echo "❌ EXAONE 테스트 실패: 피드백 결과가 비어있거나 오류 발생."
fi

echo ""
echo "======================================================"
echo "    ✅ LLM API 통합 테스트 완료"
echo "======================================================"
```

### 📋 실행 방법

1.  WSL2 환경에서 `llm_test_suite.sh` 파일을 저장합니다.
2.  세 개의 FastAPI 서버(8001, 8002, 8003)와 Node.js LLM API 서버(3000)가 모두 실행 중인지 확인합니다.
3.  스크립트에 실행 권한을 부여하고 실행합니다.
    ```bash
    chmod +x llm_test_suite.sh
    ./llm_test_suite.sh
    
