// src/app.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mysqlPool from './config/db.mysql.js';
import postgresPool from './config/db.postgres.js';
import problemRoutes from './routes/problem.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// 한국 시간 타임스탬프 유틸
// yyyy-mm-dd hh24:mi:ss (Asia/Seoul)
const ts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day} ${obj.hour}:${obj.minute}:${obj.second}`;
};

// morgan에 타임스탬프 토큰 추가
morgan.token('ts', ts);

// 미들웨어
app.use(cors());
app.use(morgan('[ :ts ] :method :url :status :res[content-length] - :response-time ms'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 데이터베이스 연결 테스트 (부팅 시 1회)
(async () => {
  try {
    const mysqlConnection = await mysqlPool.getConnection();
    console.log(`[ ${ts()} ] ✅ (app.js)MySQL database connected successfully!`);
    mysqlConnection.release();

    const postgresConnection = await postgresPool.connect();
    console.log(`[ ${ts()} ] ✅ (app.js)PostgreSQL database connected successfully!`);
    postgresConnection.release();
  } catch (error) {
    console.error(`[ ${ts()} ] ❌ (app.js)Database connection failed:`, error.message);
  }
})();

// 기본 라우터
app.get('/', (req, res) => {
  res.json({ message: '(app.js)Backend server is running 🚀', time: ts() });
});

// 문제 라우트 등록
app.use('/api/problems', problemRoutes);

// (선택) 공통 에러 핸들러 — 발생 시간 포함
app.use((err, req, res, next) => {
  console.error(`[ ${ts()} ] Unhandled Error:`, err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`[ ${ts()} ] ✅ (app.js)Server running on http://localhost:${PORT}`);
});
