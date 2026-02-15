// api.js

// 환경별 API 주소 자동 설정
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api" // 개발 환경
    : "https://api.mequest.com/api"; // 운영 배포 환경 (예시)

export async function createProblem(topic, question, answer) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert("로그인이 필요합니다.");
    window.location.href = "login.html";
    throw new Error("Unauthorized");
  }

  // user_id는 토큰에서 추출하거나 백엔드에서 처리 (백엔드 미들웨어 구현 전까지는 user_id: 1 유지하되 헤더 추가)
  // MVP 단계: 백엔드에서 아직 토큰으로 user_id를 추출하는 미들웨어가 없으므로,
  // 1. 헤더에 토큰 추가
  // 2. body에 user_id: 1 유지 (추후 제거 예정)

  const res = await fetch(`${API_BASE}/problems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      user_id: 1, // TODO: 백엔드 미들웨어 적용 후 제거
      topic,
      question_text: question,
      answer_text: answer,
      level: 1,
    }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
      localStorage.removeItem('token');
      window.location.href = "login.html";
    }
    throw new Error(`API Error: ${res.status}`);
  }
  return await res.json();
}

export async function getProblems() {
  const res = await fetch(`${API_BASE}/problems`);
  return await res.json();
}