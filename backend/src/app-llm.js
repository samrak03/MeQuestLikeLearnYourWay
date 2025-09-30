// src/app-llm.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import llmRoutes from "./routes/llmRoutes.js";

dotenv.config();

const app = express();

const PORT = process.env.LLM_PORT || 3000;

// 미들웨어
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// 라우트 등록
app.use("/api/llm", llmRoutes);


// 헬스체크 엔드포인트
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "LLM Backend", port: PORT });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ LLM Backend server running on port ${PORT}`);
});

