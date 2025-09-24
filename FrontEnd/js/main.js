import { createProblem, getProblems } from "./api.js";

document.getElementById("problemForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const topic = document.getElementById("topic").value;
  const question = document.getElementById("question").value;
  const answer = document.getElementById("answer").value;
  const resultBox = document.getElementById("result");

  try {
    const result = await createProblem(topic, question, answer);
    resultBox.classList.remove("d-none", "alert-danger");
    resultBox.classList.add("alert-success");
    resultBox.textContent = `문제 등록 성공! 문제 ID: ${result.id}`;
    
    // 문제 목록 새로고침
    const problems = await getProblems();
    console.log("현재 문제 목록:", problems);
  } catch (err) {
    resultBox.classList.remove("d-none", "alert-success");
    resultBox.classList.add("alert-danger");
    resultBox.textContent = "문제 등록 실패: " + err.message;
  }
});
