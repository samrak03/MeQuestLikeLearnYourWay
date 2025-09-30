// /mnt/d/MeQuest/Backend/src/app.js

import express from "express";
import llmRoutes from "./routes/llmRoutes.js";

const app = express();
app.use(express.json());

// API 라우트 등록
app.use("/api/test/llm", llmRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
