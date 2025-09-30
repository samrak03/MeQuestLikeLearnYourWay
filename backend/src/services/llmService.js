// /mnt/d/MeQuest/Backend/src/services/llmService.js

import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

const GECKO_API_URL = process.env.GECKO_API_URL || "http://localhost:8001/generate";

export async function callGecko(topic) {
  try {
    const response = await axios.post(GECKO_API_URL, {
      topic,
      max_new_tokens: 256,
      temperature: 0.8,
      top_p: 0.9,
      repetition_penalty: 1.2,
    });

    return response.data;
  } catch (error) {
    console.error("❌ GECKO API 호출 실패:", error.message);
    throw error;
  }
}
