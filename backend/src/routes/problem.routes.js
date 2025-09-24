// routes/problem.routes.js
import express from 'express';
import { createProblem, getProblems } from '../controllers/problem.controller.js';

const router = express.Router();

// 문제 등록
router.post('/', createProblem);

// 문제 목록 조회 (테스트용)
router.get('/', getProblems);

export default router;
