// api.js

// 환경별 API 주소 자동 설정
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api"
    : "https://api.mequest.com/api";

export async function createProblem(topic, question, answer) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert("로그인이 필요합니다.");
    window.location.href = "login.html";
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${API_BASE}/problems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    // 백엔드 스키마에 맞춰 필드 전송
    body: JSON.stringify({
      user_id: 1, // 임시 하드코딩 (로그인 연동 전)
      topic,
      // title: `${topic} 문제`, // 백엔드 미사용
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
    const errData = await res.json();
    throw new Error(errData.message || `API Error: ${res.status}`);
  }
  return await res.json();
}

export async function getProblems() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/problems`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch problems: ${res.status}`);
  }
  return await res.json();
}