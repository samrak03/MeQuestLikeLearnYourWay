// /mnt/d/MeQuest/Backend/src/services/llmService.js

import axios from "axios";
import dotenv from 'dotenv';
import { searchByText } from "../services/EmbeddigService.js";
import { mysqlConn } from "../config/db.mysql.js";


dotenv.config();

const GECKO_LLM_URL = process.env.GECKO_LLM_URL || "http://localhost:8001/generate";
const SOLAR_LLM_URL = process.env.SOLAR_LLM_URL || "http://localhost:8002/summarize";
const EXAONE_LLM_URL = process.env.EXAONE_LLM_URL || "http://localhost:8003/feedback";


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

// SOLAR 호출
export async function callSolar(document) {
  try {
    const payload = { document }; // <-- text → document
    const { data } = await axios.post(SOLAR_LLM_URL, payload); // ✅ 전역 변수 사용
    return data;
  } catch (error) {
    console.error("❌ SOLAR 호출 실패:", error.message);
    throw error;
  }
}

// EXAONE 호출
export async function callExaone(question, userAnswer, correctAnswer) {
  try {
    const response = await axios.post(`${EXAONE_LLM_URL}`, {
      question,
      user_answer: userAnswer,
      correct_answer: correctAnswer,
    });
    return response.data;
  } catch (error) {
    console.error("❌ EXAONE API 호출 실패:", error.message);
    throw error;
  }
}


function buildPrompt(topic, contexts) {
  const contextBlock = contexts
    .map(
      (c, i) =>
        `# CONTEXT ${i + 1}\n${c.content.trim()}\n(거리:${c.distance?.toFixed?.(4) ?? "NA"})`
    )
    .join("\n\n");

  return [
    `당신은 교과 기반 문제 생성기입니다.`,
    `주제: ${topic}`,
    `아래 컨텍스트를 근거로 정확한 문제 1개를 생성하세요.`,
    `- 보기나 수치가 필요하면 컨텍스트를 우선 사용`,
    `- 정답도 함께 생성`,
    `- 포맷:`,
    `QUESTION: ...`,
    `ANSWER: ...`,
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
  //   - GECKO가 “QUESTION:… / ANSWER: …” 두 줄을 반환한다고 가정
  const text = String(data?.result ?? "");
  const q = text.split("ANSWER:")[0].replace(/^QUESTION:\s*/i, "").trim();
  const a = text.split("ANSWER:")[1]?.trim() ?? "";

  // 최소 방어
  const question_text = q || topic;
  const answer_text = a || "";

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
      JSON.stringify({ topic, retrieved: hits.map(h => ({ id: h.id, ref_id: h.ref_id, distance: h.distance })) }),
      "GECKO",
    ]
  );

  return { problemId, question_text, answer_text, raw: data };
}