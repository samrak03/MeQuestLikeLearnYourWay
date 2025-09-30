// /mnt/d/MeQuest/Backend/src/services/llmService.js

import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

const GECKO_API_URL = process.env.GECKO_API_URL || "http://localhost:8001/generate";
const SOLAR_API_URL = process.env.SOLAR_API_URL || "http://localhost:8002/summarize";
const EXAONE_LLM_URL = process.env.SOLAR_API_URL || "http://localhost:8003/feedback";

// GECKO 호출
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

// SOLAR 호출
export async function callSolar(document) {
  try {
    const payload = { document }; // <-- text → document
    const { data } = await axios.post(
      process.env.SOLAR_API_URL || "http://localhost:8002/summarize",
      payload
    );
    return data;
  } catch (error) {
    console.error("❌ SOLAR 호출 실패:", error.message);
    throw error;
  }
}

// EXAONE 호출
export async function callExaone(question, userAnswer, correctAnswer) {
  try {
    const response = await axios.post(`${EXAONE_API_URL}/feedback`, {
      question,
      user_answer: userAnswer,
      correct_answer: correctAnswer,
    });
    return response.data;
  } catch (error) {
    console.error("❌ EXAONE API 호출 실패:", error.message);
    throw error;
  }
}
