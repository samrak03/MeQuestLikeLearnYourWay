import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_NAME,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT || 5432,
  max: 10, //최대 연결수 설정
});

// 연결 테스트
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ (db.postgres.js)PostgreSQL database connected successfully!');
    client.release(); // 연결 해제
  } catch (error) {
    console.error('❌ (db.postgres.js)PostgreSQL connection failed:', error.message);
  }
}

testConnection();

export default pool;