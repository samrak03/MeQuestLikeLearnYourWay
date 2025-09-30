import express from "express";
import { testGecko, testSolar, testExaone } from "../controllers/llmController.js";

const router = express.Router();

router.post("/gecko", testGecko);   // 반드시 POST
router.post("/solar", testSolar);
router.post("/exaone", testExaone);

export default router;
