// /mnt/d/MeQuest/Backend/src/controllers/llmController.js

import { callGeckoRAG, callGecko, callSolar, callExaone } from "../services/llmService.js";

// RAG 기반 문제 생성 엔드포인트
export async function generateProblemRAG(req, res) {
  const { topic, topK, filter } = req.body;

  if (!topic) {
    return res.status(400).json({ success: false, message: '주제(topic)는 필수 입력값입니다.' });
  }

  try {
    // 1. llmService의 RAG 통합 함수 호출
    const result = await callGeckoRAG({ topic, topK, filter });

    // 2. 클라이언트에게 성공적으로 생성된 문제 반환
    res.status(200).json({
      success: true,
      data: {
        problemId: result.problemId,
        question: result.question_text,
        answer: result.answer_text,
        // 디버깅을 위해 raw 응답은 제거하거나, 환경에 따라 선택적으로 포함 가능
      },
    });
  } catch (error) {
    console.error('❌ Controller Error - RAG 문제 생성:', error.message);
    res.status(500).json({ success: false, message: 'RAG 기반 문제 생성 중 서버 오류가 발생했습니다.', error: error.message });
  }
}

// SOLAR 문서 요약 (추가/구현)
export async function summarizeDocument(req, res) {
    const { document } = req.body;

    // 1. 입력 유효성 검사
    if (!document || typeof document !== 'string' || document.trim().length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: "요약할 'document' 필드가 요청 본문에 필요합니다." 
        });
    }

    try {
        // 2. 서비스 호출 
        const result = await callSolar(document);
        
        // 3. 응답 반환
        res.json({ 
            success: true, 
            summary: result.summary // 💡 평탄화된 결과 (llmService.js에서 {summary: text} 반환 가정) 
        });
    } catch (error) {
        console.error('summarizeDocument 라우트 처리 오류:', error.message);
        res.status(500).json({ 
            success: false, 
            message: "SOLAR 서비스 처리 중 오류가 발생했습니다.", 
            error: error.message 
        });
    }
}

// 오답 피드백 엔드포인트
export async function provideFeedback(req, res) {
  const body = req.body || {};
  const question = typeof body.question === "string" ? body.question.trim() : "";

  // camelCase / snake_case 모두 허용
  const userAnswer = typeof (body.userAnswer ?? body.user_answer) === "string"
    ? (body.userAnswer ?? body.user_answer).trim()
    : "";
  const correctAnswer = typeof (body.correctAnswer ?? body.correct_answer) === "string"
    ? (body.correctAnswer ?? body.correct_answer).trim()
    : "";

  if (!question || !userAnswer || !correctAnswer) {
    return res.status(400).json({
      success: false,
      message: "모든 피드백 관련 정보(문제, 사용자 답변, 정답)는 필수입니다.",
    });
  }

  try {
    const result = await callExaone(question, userAnswer, correctAnswer);
    // 스키마 통일: data 래핑
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Controller Error - EXAONE 피드백:", error.message);
    return res.status(500).json({
      success: false,
      message: "오답 피드백 생성 중 서버 오류가 발생했습니다.",
      error: error.message,
    });
  }
}


export async function testGecko(req, res) {
  try {
    const topic = req.query.topic || "이차방정식";
    const result = await callGecko(topic);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "GECKO-7B 호출 실패", detail: error.message });
  }
}

export async function testSolar(req, res) {
  try {
    const text = req.query.text || "딥러닝은 인공지능의 한 분야로, 신경망을 기반으로 한 모델을 사용한다.";
    const result = await callSolar(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "SOLAR-10.7B 호출 실패", detail: error.message });
  }
}

export async function testExaone(req, res) {
  try {
    const { question, user_answer, correct_answer } = req.body;
     // 💡 디버깅용 로그 추가 (EXAONE 호출 전)
    // console.log(`[EXAONE Debug] Q: ${question}, UA: ${user_answer}, CA: ${correct_answer}`);

    const result = await callExaone(question, user_answer, correct_answer);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "EXAONE 호출 실패",
      detail: error.message,
    });
  }
}