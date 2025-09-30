import express from "express";
import { testGecko } from "../controllers/llmController.js";

const router = express.Router();

router.get("/gecko", testGecko);

export default router;
