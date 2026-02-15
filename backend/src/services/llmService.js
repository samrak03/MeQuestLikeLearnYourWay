// /mnt/d/MeQuest/Backend/src/services/llmService.js

import axios from "axios";
import { searchByText } from "../services/EmbeddingService.js";
import { mysqlConn } from "../config/db.mysql.js";
import { config } from '../config/index.js';

const GECKO_LLM_URL = config.llm.geckoUrl;
const SOLAR_LLM_URL = config.llm.solarUrl;
const EXAONE_LLM_URL = config.llm.exaoneUrl;


// GECKO 호출
export async function callGecko(topic) {
  try {
    const response = await axios.post(GECKO_LLM_URL, {
      topic,
      max_new_tokens: 256,
      temperature: 0.8,
      top_p: 0.9,
      repetition_penalty: 1.2,
    });

    return response.data;
  } catch (error) {
    console.error("❌ GECKO API 호출 실패:", error.message);
    throw error;
  }
}

// --- 2. SOLAR 호출 (문서 요약) ---
export async function callSolar(document) {
  if (!SOLAR_LLM_URL) throw new Error("SOLAR_LLM_URL이 설정되지 않았습니다.");

  let summaryText = "";
  const payload = { document };
  const modelName = "SOLAR";

  try {
    const startTime = Date.now();
    const { data } = await axios.post(
      `${SOLAR_LLM_URL}`,
      payload,
      { timeout: 60_000 }
    );
    const latency = Date.now() - startTime;

    // ✅ 응답 안전 파싱 (string / object / fallback)

    if (typeof data?.summary === "string") {
      summaryText = data.summary.trim();
    } else if (data?.summary && typeof data.summary.summary === "string") {
      summaryText = data.summary.summary.trim();
    } else {
      summaryText = String(data?.result ?? data?.text ?? data?.generated_text ?? "").trim();
    }

    // 최소 보정: 완전히 비어있다면 입력의 앞부분이라도 반환
    if (!summaryText) summaryText = document.slice(0, 300);

    // MySQL 로깅
    await mysqlConn.execute(
      `INSERT INTO logs (user_id, problem_id, activity_type, is_correct, feedback, details, model_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        1,
        null, // 문제 생성이 아님
        "summarize",
        null,
        null,
        JSON.stringify({
          document_length: document.length,
          summary_length: summaryText.length,
          latency_ms: latency,
          raw_output: data?.generated_text?.slice(0, 1000) || summaryText.slice(0, 1000)
        }),
        modelName,
      ]
    );

    return { summary: summaryText }; // 평탄화된 결과 반환

  } catch (error) {
    console.error(`❌ ${modelName} API 호출 실패:`, error.message);
    throw error;
  }
}


// EXAONE 호출
export async function callExaone(question, userAnswer, correctAnswer) {
  if (!EXAONE_LLM_URL) throw new Error("EXAONE_LLM_URL이 설정되지 않았습니다.");

  let feedbackText = "";
  const modelName = "EXAONE";
  const payload = {
    question,
    user_answer: userAnswer,
    correct_answer: correctAnswer,
  };

  try {
    const startTime = Date.now();
    const response = await axios.post(`${EXAONE_LLM_URL}`, payload);
    const latency = Date.now() - startTime;

    // 💡 EXAONE FastAPI 응답 파싱: 'output' 키를 기대합니다.
    feedbackText = String(response.data?.feedback ?? response.data?.output ?? response.data?.generated_text ?? "").trim();


    // 2. MySQL 로깅 (피드백 활동 기록)
    await mysqlConn.execute(
      `INSERT INTO logs (user_id, problem_id, activity_type, is_correct, feedback, details, model_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        1,
        null, // 문제 ID는 현재 알 수 없음 (추후 문제 제출 로직과 통합 시 수정)
        "feedback",
        null, // 정답 여부 정보 없음
        feedbackText.length > 0 ? feedbackText : null, // feedback 컬럼에 텍스트 저장
        JSON.stringify({
          latency_ms: latency,
          question: question,
          user_answer: userAnswer,
          correct_answer: correctAnswer,
          raw_output: feedbackText.slice(0, 1000)
        }),
        modelName,
      ]
    );

    // 3. 컨트롤러로 반환할 최종 데이터
    return { feedback: feedbackText };

  } catch (error) {
    console.error(`❌ ${modelName} API 호출 실패:`, error.message);
    throw error;
  }
}


function buildPrompt(topic, contexts) {
  const contextBlock = (contexts || [])
    .map((c, i) => {
      const content = String(c?.content ?? "").trim();
      const dist = typeof c?.distance === "number" ? c.distance.toFixed(4) : "NA";
      return `# CONTEXT ${i + 1}\n${content}\n(거리:${dist})`;
    })
    .join("\n\n");

  return [
    `당신은 교과 기반 문제 생성기입니다.`,
    `주제: ${topic}`,
    `요구사항: 아래 컨텍스트만을 근거로 단일 문제와 정답을 한국어로 생성하세요. 추측 금지.`,
    `출력형식(JSON, 한 줄, 추가 텍스트 금지):`,
    `{"question":"...","answer":"..."}`,
    ``,
    `===== KNOWLEDGE CONTEXT =====`,
    contextBlock || "(no retrieved context)",
  ].join("\n");
}

export async function callGeckoRAG({ topic, topK = 5, filter = { source: "problem" } }) {
  if (!GECKO_LLM_URL) throw new Error("GECKO_LLM_URL is not set");

  // 1) 검색 (토픽 기반)
  const hits = await searchByText(topic, topK, filter);

  // 2) 프롬프트 구성
  const prompt = buildPrompt(topic, hits);

  // 3) GECKO 호출
  const payload = {
    topic: prompt, // 💡 'input' 대신 'prompt' 키를 사용합니다.
    // GECKO FastAPI가 개별 LLM 설정을 받도록 payload에 포함
    max_new_tokens: 256,
    temperature: 0.8,
    top_p: 0.9,
    repetition_penalty: 1.2,
  };

  const { data } = await axios.post(
    `${GECKO_LLM_URL}`,
    payload, // 💡 수정된 payload 사용
    { timeout: 60_000 }
  );

  // 4) MySQL 저장 (problems/ logs)
  const raw = data?.parsed_json;
  let question_text = raw?.question?.toString().trim() || "";
  let answer_text = raw?.answer?.toString().trim() || "";
  if (!question_text || !answer_text) {
    const rawText = String(data?.result ?? data?.output ?? data?.text ?? "");
    const qMatch = rawText.match(/QUESTION\s*:\s*([\s\S]*?)\nANSWER\s*:/i);
    const aMatch = rawText.match(/ANSWER\s*:\s*([\s\S]*)$/i);
    if (qMatch) question_text = qMatch[1].trim();
    if (aMatch) answer_text = aMatch[1].trim();
    if (!question_text) question_text = topic;
    if (!answer_text) answer_text = "";
  }


  // INSERT problems
  const [res] = await mysqlConn.execute(
    `INSERT INTO problems (user_id, topic, question_text, answer_text, level)
     VALUES (?, ?, ?, ?, ?)`,
    [1, topic, question_text, answer_text, 1]
  );
  const problemId = res.insertId;

  // INSERT logs (activity_type='generate', model_name='GECKO')
  await mysqlConn.execute(
    `INSERT INTO logs (user_id, problem_id, activity_type, is_correct, feedback, details, model_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      problemId,
      "generate",
      null,
      null,
      JSON.stringify({
        topic,
        retrieved: hits.map(h => ({ id: h.id, ref_id: h.ref_id, distance: h.distance })),
        // LLM 생성 결과의 원본 텍스트도 로그에 추가 (디버깅 용이)
        raw_output: data?.generated_text.slice(0, 1000) // 너무 길면 잘라냄
      }),
      "GECKO",
    ]
  );

  return { problemId, question_text, answer_text, raw: data };
}