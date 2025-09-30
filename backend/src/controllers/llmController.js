// /mnt/d/MeQuest/Backend/src/controllers/llmController.js

import { callGecko, callSolar, callExaone } from "../services/llmService.js";


export async function testGecko(req, res) {
  try {
    const topic = req.query.topic || "이차방정식";
    const result = await callGecko(topic);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "GECKO-7B 호출 실패", detail: error.message });
  }
}

export async function testSolar(req, res) {
  try {
    const text = req.query.text || "딥러닝은 인공지능의 한 분야로, 신경망을 기반으로 한 모델을 사용한다.";
    const result = await callSolar(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "SOLAR-10.7B 호출 실패", detail: error.message });
  }
}

export async function testExaone(req, res) {
  try {
    const { question, user_answer, correct_answer } = req.body;
    const result = await callExaone(question, user_answer, correct_answer);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "EXAONE 호출 실패",
      detail: error.message,
    });
  }
}