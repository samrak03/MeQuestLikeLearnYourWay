// src/app-llm.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import llmRoutes from "./routes/llmRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.LLM_PORT || 3000;

// 한국 시간 타임스탬프 유틸
// yyyy-mm-dd hh24:mi:ss (Asia/Seoul)
const ts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day} ${obj.hour}:${obj.minute}:${obj.second}`;
};

// morgan에 타임스탬프 토큰 추가
morgan.token("ts", ts);

// 미들웨어
app.use(cors());
// 요청 로그: [시간] METHOD URL status bytes - responseTime ms
app.use(morgan("[ :ts ] :method :url :status :res[content-length] - :response-time ms"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// 라우트 등록
app.use("/api/llm", llmRoutes);

// 헬스체크 엔드포인트
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "LLM Backend", port: PORT, time: ts() });
});

app.get("/", (req, res) => {
  res.send("MeQuest LLM Gateway Operational");
});

// (선택) 공통 에러 핸들러 — 에러 발생 시간도 함께 로깅
app.use((err, req, res, next) => {
  console.error(`[ ${ts()} ] Unhandled Error:`, err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`[ ${ts()} ] LLM Gateway running on port ${PORT}`);
  console.log(`[ ${ts()} ] RAG Endpoint: http://localhost:${PORT}/api/llm/generate/rag`);
});
