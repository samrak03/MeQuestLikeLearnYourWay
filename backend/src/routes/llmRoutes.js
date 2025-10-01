// src/routes/app-llm.js

import express from "express";
import { generateProblemRAG, summarizeDocument, provideFeedback, testGecko, testSolar, testExaone } from "../controllers/llmController.js";

const router = express.Router();

router.post("/gecko", testGecko);   // 반드시 POST
router.post("/solar", testSolar);
router.post("/exaone", testExaone);

// GECKO (RAG 기반 문제 생성)
// POST /api/llm/generate/rag
router.post('/generate/rag', generateProblemRAG);

// SOLAR (문서 요약)
// POST /api/llm/summarize
router.post('/summarize', summarizeDocument);

// EXAONE (오답 피드백)
// POST /api/llm/feedback
router.post('/feedback', provideFeedback);

export default router;
