// /mnt/d/MeQuest/Backend/testGecko.js

const axios = require("axios");

async function testGecko() {
  try {
    const response = await axios.post("http://localhost:8001/generate", {
      topic: "이차방정식",
      max_new_tokens: 200,
      temperature: 0.8,
      top_p: 0.9,
      repetition_penalty: 1.2,
    });

    console.log("=== GECKO-7B Response ===");
    console.log("Prompt:", response.data.prompt);
    console.log("Generated Text:", response.data.generated_text);

    if (response.data.parsed_json) {
      console.log("Parsed JSON:", response.data.parsed_json);
    } else {
      console.log("⚠️ JSON 파싱 실패 - 원본 텍스트 사용 필요");
    }
  } catch (err) {
    console.error("❌ GECKO-7B 호출 실패:", err.message);
  }
}

testGecko();
