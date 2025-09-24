// api.js

// 환경별 API 주소 자동 설정
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api" // 개발 환경
    : "https://api.mequest.com/api"; // 운영 배포 환경 (예시)

export async function createProblem(topic, question, answer) {
  const res = await fetch(`${API_BASE}/problems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: 1, // MVP 단계에서는 고정 사용자 ID
      topic,
      question_text: question,
      answer_text: answer,
      level: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }
  return await res.json();
}

export async function getProblems() {
  const res = await fetch(`${API_BASE}/problems`);
  return await res.json();
}