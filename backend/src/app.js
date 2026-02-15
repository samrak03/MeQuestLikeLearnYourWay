// src/app.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { mysqlConn } from './config/db.mysql.js';
import { pgPool } from './config/db.postgres.js';
import problemRoutes from './routes/problem.routes.js';
import authRoutes from './routes/auth.routes.js';
import { config } from './config/index.js';

const app = express();
const PORT = config.port;

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

// 데이터베이스// DB Connection Test
(async () => {
  try {
    const connection = await mysqlConn.getConnection();
    console.log(`[ ${ts()} ] ✅ (app.js)MySQL Connected`);
    connection.release();
  } catch (error) {
    console.error(`[ ${ts()} ] ❌ (app.js)Database connection failed:`, error.message);
  }

  try {
    const client = await pgPool.connect();
    console.log(`[ ${ts()} ] ✅ (app.js)PostgreSQL Connected`);
    client.release();
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
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Log error details
  console.error(`[ ${ts()} ] ❌ Error: ${message}`);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;
