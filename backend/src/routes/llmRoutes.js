import express from "express";
import { testGecko, testSolar } from "../controllers/llmController.js";

const router = express.Router();

router.get("/gecko", testGecko);
router.get("/solar", testSolar);

export default router;
