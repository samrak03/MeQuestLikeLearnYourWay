import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mysqlPool from './config/db.mysql.js';
import postgresPool from './config/db.postgres.js';
import problemRoutes from './routes/problem.routes.js';

dotenv.config();
const app = express();

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));



// 데이터베이스 연결 테스트
// 이 코드는 서버가 시작될 때 데이터베이스 연결을 확인합니다.
(async () => {
  try {
    // MySQL 연결 테스트
    const mysqlConnection = await mysqlPool.getConnection();
    console.log('✅ (app.js)MySQL database connected successfully!');
    mysqlConnection.release();
    
    //PostgreSQL 연결 테스트
    const postgresConnection = await postgresPool.connect();
    console.log('✅ (app.js)PostgreSQL database connected successfully!');
    postgresConnection.release();

  } catch (error) {
    console.error('❌ (app.js)Database connection failed:', error.message);
  }
})();



// 기본 라우터
app.get('/', (req, res) => {
  res.json({ message: '(app.js)Backend server is running 🚀' });
});

// 문제 라우트 등록
app.use('/api/problems', problemRoutes);


// 서버 실행
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ (app.js)Server running on http://localhost:${PORT}`);
});

