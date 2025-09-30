// /mnt/d/MeQuest/Backend/src/controllers/llmController.js

import { callGecko } from "../services/llmService.js";

export async function testGecko(req, res) {
  try {
    const topic = req.query.topic || "이차방정식";
    const result = await callGecko(topic);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "GECKO-7B 호출 실패", detail: error.message });
  }
}
